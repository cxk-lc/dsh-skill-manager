/**
 * SkillHub (api.skillhub.cn): keyword search plus versioned zip downloads.
 * @module dsh-skill-manager/sources/skillhub
 */
import { fetchBytes, fetchJson } from '../http.js'
import { unzip } from '../zip.js'

const API_BASE = 'https://api.skillhub.cn'
const PAGE_SIZE_DEFAULT = 12

function text(value) {
  return String(value ?? '').trim()
}

/**
 * @param {{query: string, page?: number, limit?: number}} options
 * @returns {Promise<{items: Array<object>, total: number, page: number}>}
 */
export async function searchSkillHub({ query, page = 1, limit = PAGE_SIZE_DEFAULT }) {
  const params = new URLSearchParams()
  const keyword = text(query)
  if (keyword) params.set('keyword', keyword)
  params.set('sortBy', keyword ? 'score' : 'downloads')
  params.set('order', 'desc')
  params.set('page', String(Math.max(1, page)))
  params.set('pageSize', String(Math.min(48, Math.max(1, limit))))

  const body = await fetchJson(`${API_BASE}/api/skills?${params.toString()}`, {
    headers: { accept: 'application/json' },
    timeoutMs: 15_000,
  })
  const payload = body && body.data ? body.data : body
  const list = Array.isArray(payload?.skills) ? payload.skills : Array.isArray(payload) ? payload : []
  const total = Number(payload?.total ?? list.length) || list.length

  const items = list
    .map((raw) => {
      const slug = text(raw.slug || raw.id)
      if (!slug) return null
      return {
        platform: 'skillhub',
        id: slug,
        name: text(raw.displayName || raw.name) || slug,
        description: text(raw.description_zh || raw.description),
        author: text(raw.ownerName || raw.namespace?.handle || raw.publisher),
        version: text(raw.version),
        downloads: Number(raw.downloads || raw.stats?.downloads || 0) || 0,
        stars: Number(raw.stars || raw.stats?.stars || 0) || 0,
        category: text(raw.category),
        url: `https://skillhub.cn/skills/${encodeURIComponent(slug)}`,
        iconUrl: text(raw.iconUrl),
        spec: { kind: 'skillhub', slug },
      }
    })
    .filter(Boolean)

  return { items, total, page: Math.max(1, page) }
}

/**
 * @param {{slug: string, version?: string}} spec
 * @returns {Promise<Record<string, Buffer>>}
 */
export async function fetchSkillHubFiles(spec) {
  const slug = text(spec.slug)
  if (!slug) throw new Error('缺少技能 slug')
  const version = text(spec.version)
  const url =
    `${API_BASE}/api/v1/download?slug=${encodeURIComponent(slug)}&source=dsh` +
    (version ? `&version=${encodeURIComponent(version)}` : '')
  const body = await fetchBytes(url, { timeoutMs: 60_000 })
  if (body.subarray(0, 2).toString('latin1') !== 'PK') {
    throw new Error(`SkillHub 返回的不是 zip 包：${slug}`)
  }
  return unzip(body)
}
