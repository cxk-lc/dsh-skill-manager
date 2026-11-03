/**
 * dsh-skill-manager — host half.
 *
 * One same-origin JSON endpoint serves the browser half. Every filesystem or
 * network operation lives here; the page never receives a writable path.
 * @module dsh-skill-manager
 */
import { readConfig, saveConfig } from './config.js'
import { installSkill, uninstallSkill } from './install.js'
import { displayPath, skillRoots } from './paths.js'
import fs from 'node:fs/promises'
import { listInstalled } from './registry.js'
import { scanRepoCards, searchGithub } from './sources/github.js'
import { searchSkillHub } from './sources/skillhub.js'
import { searchSkillsMp } from './sources/skillsmp.js'

export const name = 'skill-manager'

const VERSION = '0.2.0'
const CAPABILITIES = ['githubSearch', 'targetRoots', 'releaseBadge']
const API_PATH = '/dsh-skill-manager/api'
const MAX_BODY_BYTES = 1024 * 1024
const CSRF_HEADER = 'x-dsh-skill-manager'

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text) return resolve({})
      try {
        const parsed = JSON.parse(text)
        resolve(parsed && typeof parsed === 'object' ? parsed : {})
      } catch {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function installedKeys(items) {
  const keys = new Set()
  for (const item of items) {
    if (item.dirName) keys.add(String(item.dirName).toLowerCase())
    if (item.name) keys.add(String(item.name).toLowerCase())
  }
  return keys
}

function markInstalled(items, keys) {
  return items.map((item) => ({
    ...item,
    installed:
      keys.has(String(item.name).toLowerCase()) ||
      keys.has(String(item.id).toLowerCase()) ||
      (item.spec?.kind === 'skillhub' && keys.has(String(item.spec.slug).toLowerCase())),
  }))
}

const handlers = {
  async status() {
    const config = await readConfig()
    const roots = []
    for (const root of skillRoots()) {
      const exists = await fs
        .access(root.path)
        .then(() => true)
        .catch(() => false)
      roots.push({
        id: root.id,
        label: root.label,
        path: displayPath(root.path),
        writable: root.writable,
        exists,
      })
    }
    return {
      version: VERSION,
      capabilities: CAPABILITIES,
      roots,
      config: { githubToken: Boolean(config.githubToken), skillsmpKey: Boolean(config.skillsmpKey) },
    }
  },

  async installed() {
    const items = await listInstalled()
    return { items, roots: skillRoots().map((root) => ({ id: root.id, label: root.label, path: displayPath(root.path) })) }
  },

  async search({ platform, query, page, limit }) {
    const config = await readConfig()
    const installed = installedKeys(await listInstalled())
    if (platform === 'skillsmp') {
      const result = await searchSkillsMp({ query, page, limit, key: config.skillsmpKey })
      return { ...result, items: markInstalled(result.items, installed) }
    }
    if (platform === 'skillhub' || platform === undefined) {
      const result = await searchSkillHub({ query, page, limit })
      return { ...result, items: markInstalled(result.items, installed) }
    }
    throw new Error(`未知平台：${platform}`)
  },

  async repoScan({ input }) {
    const config = await readConfig()
    const result = await scanRepoCards({ input, token: config.githubToken })
    const installed = installedKeys(await listInstalled())
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        installed: installed.has(String(item.name).toLowerCase()),
      })),
    }
  },

  async githubSearch({ input, limit }) {
    const config = await readConfig()
    const result = await searchGithub({
      input,
      token: config.githubToken,
      limit: Number(limit) || 12,
      // Anonymous name search borrows SkillsMP's index; installation still goes
      // through GitHub, so the cards stay GitHub-sourced.
      fallbackIndex: async (term, size) => {
        const found = await searchSkillsMp({ query: term, limit: size, key: config.skillsmpKey })
        return found.items
      },
    })
    const installed = installedKeys(await listInstalled())
    return {
      ...result,
      items: (result.items || []).map((item) => ({
        ...item,
        installed: installed.has(String(item.name).toLowerCase()),
      })),
    }
  },

  async install({ spec, overwrite, targetRootId }) {
    const config = await readConfig()
    const result = await installSkill({
      spec,
      overwrite: Boolean(overwrite),
      token: config.githubToken,
      targetRootId: targetRootId || 'user',
    })
    return result
  },

  async uninstall({ rootId, dirName }) {
    return uninstallSkill({ rootId, dirName })
  },

  async config({ save }) {
    const next = save ? await saveConfig(save) : await readConfig()
    return { githubToken: Boolean(next.githubToken), skillsmpKey: Boolean(next.skillsmpKey) }
  },
}

async function handle(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, code: 'EMETHOD', error: '只接受 POST 请求' })
    return
  }
  if (req.headers[CSRF_HEADER] !== '1') {
    sendJson(res, 403, { ok: false, code: 'EGUARD', error: '缺少请求头，已拒绝' })
    return
  }

  let body
  try {
    body = await readBody(req)
  } catch (err) {
    sendJson(res, 400, { ok: false, code: 'EBODY', error: err instanceof Error ? err.message : '请求体解析失败' })
    return
  }

  const method = String(body.method || '')
  const handler = handlers[method]
  if (!handler) {
    sendJson(res, 400, { ok: false, code: 'ENOMETHOD', error: `未知方法：${method || '(空)'}` })
    return
  }

  try {
    const result = await handler(body)
    sendJson(res, 200, { ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const code = err && err.code ? String(err.code) : 'EFAIL'
    sendJson(res, code === 'EEXIST' ? 409 : 200, { ok: false, code, error: message })
    console.warn(`[skill-manager] ${method} failed: ${message}`)
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (c) => {
    c.webServer.register({ kind: 'exact', path: API_PATH, handler: handle })
  })
}
