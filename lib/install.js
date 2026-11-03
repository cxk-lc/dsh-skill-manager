/**
 * Install and uninstall skills: download → validate → write a staging directory
 * → swap into place. Nothing touches the target until every check has passed.
 * @module dsh-skill-manager/install
 */
import { randomUUID } from 'node:crypto'
import { writeFile as writeFileRaw } from 'node:fs/promises'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { parseFrontmatter, validateSkillMeta } from './frontmatter.js'
import { displayPath, requireRoot, resolveEntry, resolveInstallTarget } from './paths.js'
import { normalizeEntryPath, stripSingleRoot } from './zip.js'
import { fetchSkillHubFiles } from './sources/skillhub.js'
import { fetchSkillFiles as fetchGithubFiles } from './sources/github.js'
import { forgetInstall, rememberInstall } from './config.js'

/** @param {{kind: string}} spec */
export function describeSpec(spec) {
  if (!spec || typeof spec !== 'object') return '未知来源'
  if (spec.kind === 'skillhub') return `SkillHub · ${spec.slug || ''}`
  if (spec.kind === 'github') return `GitHub · ${spec.owner || ''}/${spec.repo || ''}`
  return '未知来源'
}

async function fetchFilesFor(spec, token) {
  if (spec.kind === 'skillhub') return fetchSkillHubFiles(spec)
  if (spec.kind === 'github') return fetchGithubFiles({ ...spec, token })
  throw new Error(`不支持的安装来源：${spec.kind}`)
}

function hasSkillFile(files) {
  return Object.keys(files).some((name) => name.toLowerCase() === 'skill.md')
}

function normalizeFiles(files) {
  let next = files
  if (!hasSkillFile(next)) next = stripSingleRoot(next)
  if (!hasSkillFile(next)) return next
  const out = {}
  for (const [name, body] of Object.entries(next)) {
    const normalized = normalizeEntryPath(name)
    out[normalized.toLowerCase() === 'skill.md' ? 'SKILL.md' : normalized] = body
  }
  return out
}

/**
 * Windows refuses a directory rename while a watcher or antivirus still holds a
 * handle on the new directory; the lock is short-lived, so retry briefly before
 * giving up.
 * @param {string} from
 * @param {string} to
 */
async function renameWithRetry(from, to) {
  const retryable = new Set(['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY'])
  let lastError
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rename(from, to)
      return
    } catch (err) {
      lastError = err
      if (!retryable.has(err && err.code)) break
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)))
    }
  }
  throw lastError
}

/**
 * @param {{spec: object, overwrite?: boolean, token?: string, targetRootId?: string}} options
 * @returns {Promise<{name: string, dirName: string, rootId: string, path: string, files: number, source: string, warnings: string[]}>}
 */
export async function installSkill({ spec, overwrite = false, token, targetRootId }) {
  const raw = await fetchFilesFor(spec, token)
  const files = normalizeFiles(raw)
  if (!files['SKILL.md']) {
    throw new Error('这个包里没有 SKILL.md，不是可安装的技能')
  }

  const { data } = parseFrontmatter(files['SKILL.md'].toString('utf8'))
  const meta = validateSkillMeta(data, spec.slug || spec.path?.split('/').pop() || spec.repo)
  const name = meta.name

  const root = requireRoot(targetRootId || 'user')
  const target = resolveInstallTarget(root.path, name)
  const exists = await fs.stat(target).then(() => true).catch(() => false)
  if (exists && !overwrite) {
    const error = new Error(`技能 ${name} 已存在于「${root.label}」，是否覆盖安装？`)
    error.code = 'EEXIST'
    throw error
  }

  await fs.mkdir(root.path, { recursive: true })
  const staging = path.join(root.path, `.tmp-${name}-${randomUUID().slice(0, 8)}`)
  let written = 0
  try {
    for (const [rel, body] of Object.entries(files)) {
      const dest = path.join(staging, ...rel.split('/'))
      if (!dest.startsWith(staging + path.sep) && dest !== staging) {
        throw new Error(`拒绝写入越界路径：${rel}`)
      }
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await writeFileRaw(dest, body)
      written += 1
    }
    if (!written) throw new Error('安装包为空')

    if (exists) await fs.rm(target, { recursive: true, force: true })
    await renameWithRetry(staging, target)
  } catch (err) {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined)
    throw err
  }

  const source = describeSpec(spec)
  await rememberInstall(`${root.id}/${name}`, { source, name }).catch(() => undefined)

  return {
    name,
    dirName: name,
    rootId: root.id,
    path: displayPath(target),
    files: written,
    source,
    warnings: meta.warnings,
  }
}

/**
 * @param {{rootId: string, dirName: string}} options
 * @returns {Promise<{name: string, path: string}>}
 */
export async function uninstallSkill({ rootId, dirName }) {
  const root = requireRoot(rootId)
  const entry = resolveEntry(root.path, dirName)
  const stats = await fs.stat(entry).catch(() => null)
  if (stats?.isDirectory()) {
    await fs.rm(entry, { recursive: true, force: false })
  } else {
    const flat = await fs.stat(`${entry}.md`).catch(() => null)
    if (!flat?.isFile()) throw new Error(`没有找到已安装的技能：${dirName}`)
    await fs.unlink(`${entry}.md`)
  }
  await forgetInstall(`${root.id}/${dirName}`).catch(() => undefined)
  return { name: dirName, path: displayPath(entry) }
}
