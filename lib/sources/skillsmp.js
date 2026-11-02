/**
 * SkillsMP (skillsmp.com): keyword search over GitHub-indexed SKILL.md files.
 * Installation always goes back to GitHub, so this module only discovers.
 * @module dsh-skill-manager/sources/skillsmp
 */
import { fetchJson, SourceError } from '../http.js'
import { parseRepoInput } from './github.js'

const API_BASE = 'https://skillsmp.com/api/v1'
const PAGE_SIZE_DEFAULT = 12

/**
 * @param {{query: string, page?: number, limit?: number, key?: string}} options
 * @returns {Promise<{items: Array<object>, total: number, page: number, remaining: number|null}>}
 */
export async function searchSkillsMp({ query, page = 1, limit = PAGE_SIZE_DEFAULT, key }) {
  const keyword = String(query || '').trim()
  if (!keyword) throw new Error('SkillsMP 需要先输入关键词再搜索')

  const params = new URLSearchParams()
  params.set('q', keyword)
  params.set('page', String(Math.max(1, page)))
  params.set('limit', String(Math.min(50, Math.max(1, limit))))
  params.set('sortBy', 'stars')

  const headers = { accept: 'application/json' }
  if (key) headers.authorization = `Bearer ${key}`

  let body
  try {
    body = await fetchJson(`${API_BASE}/skills/search?${params.toString()}`, { headers, timeoutMs: 15_000 })
  } catch (err) {
    if (err instanceof SourceError && err.status === 429) {
      throw new SourceError(
        key
          ? 'SkillsMP 额度已用完（HTTP 429）。可在「设置」里换一个 API Key，或等额度重置后再试。'
          : 'SkillsMP 匿名额度已用完（HTTP 429，每天 50 次）。到「设置」填一个 API Key 可以继续搜索。',
        { code: 'ERATELIMIT', status: 429 },
      )
    }
    throw err
  }

  const payload = body?.data || {}
  const list = Array.isArray(payload.skills) ? payload.skills : []
  const pagination = payload.pagination || {}
  const remainingHeader = Number(
    body?.meta?.rateLimit?.remaining ?? body?.rateLimit?.remaining ?? Number.NaN,
  )

  const items = list
    .map((raw) => {
      const githubUrl = String(raw.githubUrl || '').trim()
      let spec = null
      if (githubUrl) {
        try {
          const parsed = parseRepoInput(githubUrl)
          spec = { kind: 'github', owner: parsed.owner, repo: parsed.repo, branch: parsed.branch, path: parsed.path }
        } catch {
          spec = null
        }
      }
      if (!spec) return null
      return {
        platform: 'skillsmp',
        id: String(raw.id || githubUrl || raw.name),
        name: String(raw.name || '').trim(),
        description: String(raw.description || '').replace(/\s+/g, ' ').trim(),
        author: String(raw.author || '').trim(),
        stars: Number(raw.stars || 0) || 0,
        language: String(raw.contentLanguage || '').trim(),
        updatedAt: raw.updatedAt ? new Date(Number(raw.updatedAt) * 1000).toISOString() : '',
        url: String(raw.skillUrl || ''),
        githubUrl,
        spec,
      }
    })
    .filter(Boolean)

  const total = Number(pagination.total || items.length) || items.length
  const hasNext = Boolean(pagination.hasNext)
  return {
    items,
    total: hasNext ? Math.max(total, page * limit + 1) : total,
    page: Math.max(1, page),
    remaining: Number.isFinite(remainingHeader) ? remainingHeader : null,
  }
}
