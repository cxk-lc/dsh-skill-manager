/**
 * Where skills live and which paths may be written or deleted. Every mutation
 * funnels through this module, so the guards are in one auditable place.
 * @module dsh-skill-manager/paths
 */
import os from 'node:os'
import path from 'node:path'

/** Directory-name allowlist: no separators, no leading dot, bounded length. */
export const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

/**
 * @returns {string} DSH config root (`$DSH_HOME` or `~/.dsh`).
 */
export function dshHome() {
  const fromEnv = (process.env.DSH_HOME || '').trim()
  return fromEnv || path.join(os.homedir(), '.dsh')
}

/**
 * @returns {string} Shared agent config root (`$DSH_AGENTS_HOME` or `~/.agents`).
 */
export function agentsHome() {
  const fromEnv = (process.env.DSH_AGENTS_HOME || '').trim()
  return fromEnv || path.join(os.homedir(), '.agents')
}

/**
 * @returns {string} Where this plugin keeps its own settings and staging area.
 */
export function stateDir() {
  return path.join(dshHome(), 'skill-manager')
}

/**
 * The two user-level skill roots this plugin manages.
 * @returns {Array<{id: string, label: string, path: string, writable: boolean}>}
 */
export function skillRoots() {
  return [
    { id: 'user', label: '用户级', path: path.join(dshHome(), 'skills'), writable: true },
    { id: 'agents', label: '全局 agents', path: path.join(agentsHome(), 'skills'), writable: true },
  ]
}

/**
 * @param {string} id
 * @returns {{id: string, label: string, path: string, writable: boolean}}
 */
export function requireRoot(id) {
  const root = skillRoots().find((entry) => entry.id === id)
  if (!root) throw new Error(`未知的技能目录：${id}`)
  return root
}

/**
 * @param {string} name
 * @returns {string} the validated name
 */
export function assertSafeName(name) {
  const value = String(name || '').trim()
  if (!SAFE_NAME.test(value)) throw new Error(`技能名不合法：${name || '(空)'}`)
  return value
}

function assertInside(rootPath, candidate) {
  const root = path.resolve(rootPath)
  const target = path.resolve(candidate)
  if (path.dirname(target) !== root) throw new Error('拒绝越界访问技能目录')
  return target
}

/**
 * Resolve an installed skill entry to either its directory bundle or its flat
 * `.md` file; returns the directory form when both somehow exist.
 * @param {string} rootPath
 * @param {string} name
 * @returns {string}
 */
export function resolveEntry(rootPath, name) {
  const safe = assertSafeName(name)
  return assertInside(rootPath, path.join(rootPath, safe))
}

/**
 * The directory an install would create (always the directory-bundle form).
 * @param {string} rootPath
 * @param {string} name
 * @returns {string}
 */
export function resolveInstallTarget(rootPath, name) {
  return resolveEntry(rootPath, name)
}

/**
 * Human-friendly path for the UI (`~` for the user's home).
 * @param {string} target
 * @returns {string}
 */
export function displayPath(target) {
  const home = os.homedir()
  const resolved = path.resolve(target)
  if (resolved === home) return '~'
  if (resolved.startsWith(home + path.sep)) return '~' + resolved.slice(home.length).replace(/\\/g, '/')
  return resolved.replace(/\\/g, '/')
}
