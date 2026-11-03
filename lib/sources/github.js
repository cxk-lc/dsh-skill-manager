/**
 * GitHub as a skill source: parse a repo reference, resolve a branch, download
 * the archive once, then either list every SKILL.md inside it or extract one
 * skill's directory.
 * @module dsh-skill-manager/sources/github
 */
import { fetchBytes, fetchJson, SourceError } from '../http.js'
import { parseFrontmatter } from '../frontmatter.js'
import { stripSingleRoot, unzip } from '../zip.js'

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const REPO = /^[A-Za-z0-9._-]{1,100}$/
const MAX_SKILLS_PER_REPO = 300

const archiveCache = new Map()
const ARCHIVE_TTL_MS = 60_000

/**
 * Accepts `owner/repo`, `owner/repo@branch`, a github.com repo URL, or a
 * `/tree/<branch>/<path>` / `/blob/<branch>/.../SKILL.md` URL.
 * @param {string} input
 * @returns {{owner: string, repo: string, branch: string, path: string}}
 */
export function parseRepoInput(input) {
  let text = String(input || '').trim()
  if (!text) throw new Error('请填写 GitHub 仓库，例如 anthropics/skills')

  text = text.replace(/^git\+/, '').replace(/\.git$/, '').replace(/\/+$/, '')
  text = text.replace(/^https?:\/\//i, '').replace(/^www\./i, '')

  let branch = ''
  let subPath = ''
  if (/^github\.com\//i.test(text)) {
    text = text.replace(/^github\.com\//i, '')
    const parts = text.split('/').filter(Boolean)
    if (parts.length < 2) throw new Error('GitHub 地址缺少仓库名')
    const [owner, repo, kind, ...rest] = parts
    if (kind === 'tree' || kind === 'blob') {
      if (!rest.length) throw new Error('GitHub 地址缺少分支名')
      branch = rest[0]
      subPath = rest.slice(1).join('/')
      if (kind === 'blob') subPath = subPath.replace(/\/SKILL\.md$/i, '').replace(/^SKILL\.md$/i, '')
    } else if (kind) {
      subPath = [kind, ...rest].join('/')
    }
    return finish(owner, repo, branch, subPath)
  }

  const at = /^([^/@]+)\/([^/@]+)[@#](.+)$/.exec(text)
  if (at) return finish(at[1], at[2], at[3], '')
  const plain = /^([^/]+)\/([^/]+)(?:\/(.+))?$/.exec(text)
  if (!plain) throw new Error('无法识别的仓库格式，请用 owner/repo 或完整的 GitHub 地址')
  return finish(plain[1], plain[2], branch, plain[3] || subPath)
}

function finish(owner, repo, branch, subPath) {
  if (!OWNER.test(owner)) throw new Error(`GitHub 用户名不合法：${owner}`)
  if (!REPO.test(repo)) throw new Error(`GitHub 仓库名不合法：${repo}`)
  const cleaned = String(subPath || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
  if (cleaned.split('/').some((part) => part === '..')) throw new Error('路径里不允许出现 ..')
  return { owner, repo, branch: String(branch || '').trim(), path: cleaned }
}

function repoHeaders(token) {
  const headers = { accept: 'application/vnd.github+json' }
  if (token) headers.authorization = `Bearer ${token}`
  return headers
}

/**
 * @param {{owner: string, repo: string, token?: string}} options
 * @returns {Promise<{defaultBranch: string, stars: number, description: string}>}
 */
export async function readRepoMeta({ owner, repo, token }) {
  const data = await fetchJson(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: repoHeaders(token),
    timeoutMs: 15_000,
  })
  return {
    defaultBranch: String(data.default_branch || 'main'),
    stars: Number(data.stargazers_count || 0),
    description: String(data.description || ''),
  }
}

const MAX_ARCHIVE_CACHE = 6

function rememberArchive(key, files) {
  if (archiveCache.size >= MAX_ARCHIVE_CACHE) {
    const oldest = [...archiveCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) archiveCache.delete(oldest[0])
  }
  archiveCache.set(key, { at: Date.now(), files })
}

async function downloadArchive(owner, repo, branch, token) {
  const key = `${owner}/${repo}@${branch}`
  const hit = archiveCache.get(key)
  if (hit && Date.now() - hit.at < ARCHIVE_TTL_MS) return hit.files

  const attempts = [`https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURI(branch)}`]
  if (branch && !/^[0-9a-f]{7,40}$/i.test(branch)) {
    attempts.push(`https://codeload.github.com/${owner}/${repo}/zip/refs/tags/${encodeURI(branch)}`)
  }
  let lastError
  for (const url of attempts) {
    try {
      const body = await fetchBytes(url, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        timeoutMs: 60_000,
      })
      const files = stripSingleRoot(unzip(body))
      rememberArchive(key, files)
      return files
    } catch (err) {
      lastError = err
      if (err instanceof SourceError && (err.status === 404 || err.status === 401)) continue
      throw err
    }
  }
  throw new SourceError(
    `无法下载 ${owner}/${repo} 的归档（分支 ${branch}）：仓库可能不存在、是私有仓库，或分支名不同。若分支名不同，请写成 owner/repo@分支名。`,
    { code: 'ENOARCHIVE', status: lastError && lastError.status },
  )
}

/**
 * Resolve the branch to use, preferring an explicit one, then the API's default,
 * then the `main` / `master` conventions.
 * @param {{owner: string, repo: string, branch?: string, token?: string}} options
 * @returns {Promise<{branch: string, stars: number}>}
 */
export async function resolveBranch({ owner, repo, branch, token }) {
  if (branch) return { branch, stars: 0 }
  try {
    const meta = await readRepoMeta({ owner, repo, token })
    return { branch: meta.defaultBranch, stars: meta.stars }
  } catch {
    return { branch: 'main', stars: 0 }
  }
}

function skillNameFromPath(skillPath) {
  if (!skillPath) return ''
  const parts = skillPath.split('/')
  return parts[parts.length - 1]
}

/**
 * List every skill (SKILL.md bundle) inside a repository.
 * @param {{input: string, token?: string}} options
 * @returns {Promise<{owner: string, repo: string, branch: string, skills: Array<object>}>}
 */
export async function scanRepo({ input, token }) {
  const parsed = parseRepoInput(input)
  const { branch } = await resolveBranch({ ...parsed, token })
  let files
  try {
    files = await downloadArchive(parsed.owner, parsed.repo, branch, token)
  } catch (err) {
    if (branch === 'main') {
      files = await downloadArchive(parsed.owner, parsed.repo, 'master', token)
      return collect(parsed, 'master', files)
    }
    throw err
  }
  return collect(parsed, branch, files)
}

function collect(parsed, branch, files) {
  const names = Object.keys(files)
  const prefix = parsed.path ? parsed.path.replace(/\/+$/, '') + '/' : ''
  const skills = []
  for (const name of names.sort()) {
    if (!/(^|\/)SKILL\.md$/i.test(name)) continue
    if (prefix && !name.startsWith(prefix)) continue
    const dir = name.replace(/\/?SKILL\.md$/i, '')
    const { data } = parseFrontmatter(files[name].toString('utf8'))
    const fallback = skillNameFromPath(dir) || parsed.repo
    skills.push({
      name: String(data.name || fallback).trim() || fallback,
      dirName: fallback,
      description: String(data.description || '').replace(/\s+/g, ' ').trim(),
      version: data.version ? String(data.version).trim() : '',
      path: dir,
      files: names.filter((entry) => (dir ? entry.startsWith(dir + '/') : true)).length,
    })
    if (skills.length >= MAX_SKILLS_PER_REPO) break
  }
  if (!skills.length) {
    throw new Error(
      parsed.path
        ? `在 ${parsed.owner}/${parsed.repo} 的 ${parsed.path} 下没有找到 SKILL.md`
        : `${parsed.owner}/${parsed.repo} 里没有找到 SKILL.md（该仓库可能不是技能仓库）`,
    )
  }
  return { owner: parsed.owner, repo: parsed.repo, branch, skills }
}

/**
 * Extract one skill directory from a repository archive.
 * @param {{owner: string, repo: string, branch: string, path: string, token?: string}} spec
 * @returns {Promise<Record<string, Buffer>>}
 */
export async function fetchSkillFiles(spec) {
  const files = await downloadArchive(spec.owner, spec.repo, spec.branch, spec.token)
  const dir = String(spec.path || '').replace(/^\/+|\/+$/g, '')
  const out = {}
  for (const [name, body] of Object.entries(files)) {
    if (!dir) {
      out[name] = body
      continue
    }
    if (!name.startsWith(dir + '/')) continue
    out[name.slice(dir.length + 1)] = body
  }
  if (!out['SKILL.md']) {
    throw new Error(`仓库里找不到技能目录 ${dir || '(根目录)'} 的 SKILL.md，可能已被删除或改名`)
  }
  return out
}

const releaseCache = new Map()
const RELEASE_TTL_MS = 10 * 60_000
const RELEASE_CACHE_MAX = 200

/**
 * Latest published release of a repository, cached for ten minutes.
 * A repo without releases (404) caches as null so it is asked once per session.
 * @param {{owner: string, repo: string, token?: string}} options
 * @returns {Promise<{tag: string, name: string, url: string, publishedAt: string}|null>}
 */
export async function latestRelease({ owner, repo, token }) {
  const key = `${owner}/${repo}`.toLowerCase()
  const hit = releaseCache.get(key)
  if (hit && Date.now() - hit.at < RELEASE_TTL_MS) return hit.release

  let release = null
  try {
    const data = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers: repoHeaders(token),
      timeoutMs: 12_000,
    })
    const tag = String(data.tag_name || '').trim()
    if (tag) {
      release = {
        tag,
        name: String(data.name || '').trim(),
        url: String(data.html_url || ''),
        publishedAt: data.published_at ? String(data.published_at) : '',
      }
    }
  } catch {
    release = null
  }
  if (releaseCache.size >= RELEASE_CACHE_MAX) releaseCache.clear()
  releaseCache.set(key, { at: Date.now(), release })
  return release
}

/** Attach each card's repo release, asking at most eight repos at once. */
async function withReleases(items, token) {
  const repos = [...new Set(items.map((item) => (item.spec ? `${item.spec.owner}/${item.spec.repo}` : '')).filter(Boolean))].slice(0, 8)
  const releases = new Map()
  await Promise.allSettled(
    repos.map(async (full) => {
      const [owner, repo] = full.split('/')
      const release = await latestRelease({ owner, repo, token })
      if (release) releases.set(full.toLowerCase(), release)
    }),
  )
  return items.map((item) => {
    if (!item.spec) return item
    const release = releases.get(`${item.spec.owner}/${item.spec.repo}`.toLowerCase())
    return release ? { ...item, release } : item
  })
}

function cardFromScan(scanned, skill) {
  const full = `${scanned.owner}/${scanned.repo}`
  return {
    platform: 'github',
    id: `${full}/${skill.path || '.'}`,
    name: skill.name,
    description: skill.description,
    author: full,
    version: skill.version,
    files: skill.files,
    installed: false,
    url: `https://github.com/${full}/tree/${scanned.branch}/${skill.path}`.replace(/\/$/, ''),
    spec: {
      kind: 'github',
      owner: scanned.owner,
      repo: scanned.repo,
      branch: scanned.branch,
      path: skill.path,
    },
  }
}

/**
 * Cards for a repo scan, ready for the browser (each carrying the repo release).
 * @param {{input: string, token?: string}} options
 */
export async function scanRepoCards({ input, token }) {
  const result = await scanRepo({ input, token })
  const items = result.skills.map((skill) => cardFromScan(result, skill))
  return {
    owner: result.owner,
    repo: result.repo,
    branch: result.branch,
    items: await withReleases(items, token),
  }
}

/**
 * Whether an input names a repository rather than a skill keyword.
 * @param {string} input
 * @returns {boolean}
 */
export function looksLikeRepoRef(input) {
  const text = String(input || '').trim()
  if (!text) return false
  if (/github\.com\//i.test(text)) return true
  return /^[^/\s]+\/[^/\s]+/.test(text)
}

function rawSkillUrl(full, dir) {
  const filePath = dir ? `${dir}/SKILL.md` : 'SKILL.md'
  return `https://raw.githubusercontent.com/${full}/HEAD/${filePath.split('/').map(encodeURIComponent).join('/')}`
}

/** One card from a code-search hit, reading its SKILL.md through raw.githubusercontent. */
async function rawSkillCard(full, dir) {
  const [owner, repo] = full.split('/')
  if (!owner || !repo) return null
  let text
  try {
    const body = await fetchBytes(rawSkillUrl(full, dir), { timeoutMs: 15_000, maxBytes: 512 * 1024 })
    text = body.toString('utf8')
  } catch {
    return null
  }
  const { data } = parseFrontmatter(text)
  const fallback = skillNameFromPath(dir) || repo
  const name = String(data.name || fallback).trim() || fallback
  return {
    platform: 'github',
    id: `${full}/${dir || '.'}`,
    name,
    dir: dir || '.',
    description: String(data.description || '').replace(/\s+/g, ' ').trim(),
    author: full,
    version: data.version ? String(data.version).trim() : '',
    installed: false,
    url: `https://github.com/${full}/tree/HEAD/${dir}`.replace(/\/$/, ''),
    spec: { kind: 'github', owner, repo, branch: '', path: dir },
  }
}

async function searchByCode({ term, token, limit }) {
  const params = new URLSearchParams({
    q: `${term} filename:SKILL.md`,
    per_page: String(Math.min(50, Math.max(limit * 2, 20))),
  })
  const data = await fetchJson(`https://api.github.com/search/code?${params.toString()}`, {
    headers: repoHeaders(token),
    timeoutMs: 20_000,
  })
  const hits = Array.isArray(data.items) ? data.items : []
  const seen = new Set()
  const picked = []
  for (const hit of hits) {
    const full = String(hit.repository?.full_name || '')
    const path = String(hit.path || '')
    if (!full || !/SKILL\.md$/i.test(path)) continue
    const dir = path.replace(/\/?SKILL\.md$/i, '')
    const key = `${full}/${dir}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    picked.push({ full, dir })
    if (picked.length >= Math.min(limit * 2, 24)) break
  }

  const settled = await Promise.allSettled(picked.map(({ full, dir }) => rawSkillCard(full, dir)))
  const cards = settled.filter((entry) => entry.status === 'fulfilled' && entry.value).map((entry) => entry.value)
  const needle = term.toLowerCase()
  const byName = cards.filter(
    (item) => item.name.toLowerCase().includes(needle) || String(item.dir || '').toLowerCase().includes(needle),
  )
  return (byName.length ? byName : cards).slice(0, limit)
}

/**
 * Anonymous name search: ask an injected index (the host wires SkillsMP here)
 * for skills whose name matches, then keep only GitHub-backed entries. Native
 * GitHub code search is authenticated-only, and repo-search + archive scanning
 * proved far too slow to sit behind a search box.
 * @param {{term: string, limit: number, fallbackIndex?: (term: string, limit: number) => Promise<Array<object>>}} options
 */
async function searchByIndex({ term, limit, fallbackIndex }) {
  if (typeof fallbackIndex !== 'function') return { items: [], noteCode: 'token-required' }
  const needle = term.toLowerCase()
  let candidates = []
  try {
    candidates = await fallbackIndex(term, Math.max(limit, 24))
  } catch {
    return { items: [], noteCode: 'index-unavailable' }
  }
  const items = (candidates || [])
    .filter((item) => item && item.spec && item.spec.kind === 'github')
    .filter((item) => String(item.name || '').toLowerCase().includes(needle))
    .map((item) => ({
      platform: 'github',
      id: `${item.spec.owner}/${item.spec.repo}/${item.spec.path || '.'}`,
      name: item.name,
      description: item.description || '',
      author: `${item.spec.owner}/${item.spec.repo}`,
      stars: Number(item.stars || 0) || 0,
      installed: false,
      url: item.url || '',
      spec: item.spec,
    }))
    .slice(0, limit)
  return { items, noteCode: items.length ? 'index-fallback' : 'index-empty' }
}

/**
 * One entry point for the GitHub tab: a repo reference scans that repo, anything
 * else is treated as a skill name.
 * @param {{input: string, token?: string, limit?: number, fallbackIndex?: Function}} options
 */
export async function searchGithub({ input, token, limit = 12, fallbackIndex }) {
  const text = String(input || '').trim()
  if (!text) throw new Error('请输入 skill 名称，或 owner/repo、仓库链接')

  if (looksLikeRepoRef(text)) {
    const result = await scanRepoCards({ input: text, token })
    return { mode: 'repo', ...result }
  }

  const term = text.replace(/^#/, '')
  if (token) {
    try {
      const items = await searchByCode({ term, token, limit })
      if (items.length) return { mode: 'name', items: await withReleases(items, token), noteCode: '' }
    } catch {
      /* fall through to the unauthenticated path */
    }
  }
  const fallback = await searchByIndex({ term, limit, fallbackIndex })
  return { mode: 'name', ...fallback }
}
