/**
 * Local state: user credentials (never echoed back) and the install ledger that
 * remembers where each skill came from.
 * @module dsh-skill-manager/config
 */
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises'
import path from 'node:path'
import { stateDir } from './paths.js'

const CONFIG_FILE = 'config.json'
const LEDGER_FILE = 'installed.json'

async function readJson(file, fallback) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 })
  await chmod(file, 0o600).catch(() => undefined)
}

/** @returns {Promise<{githubToken: string, skillsmpKey: string}>} */
export async function readConfig() {
  const raw = await readJson(path.join(stateDir(), CONFIG_FILE), {})
  return {
    githubToken: typeof raw.githubToken === 'string' ? raw.githubToken : '',
    skillsmpKey: typeof raw.skillsmpKey === 'string' ? raw.skillsmpKey : '',
  }
}

/**
 * Merge a patch into the stored config; empty strings clear a field.
 * @param {{githubToken?: string, skillsmpKey?: string}} patch
 * @returns {Promise<{githubToken: string, skillsmpKey: string}>}
 */
export async function saveConfig(patch) {
  const current = await readConfig()
  const next = { ...current }
  if (patch && typeof patch.githubToken === 'string') next.githubToken = patch.githubToken.trim()
  if (patch && typeof patch.skillsmpKey === 'string') next.skillsmpKey = patch.skillsmpKey.trim()
  await writeJson(path.join(stateDir(), CONFIG_FILE), next)
  return next
}

/** @returns {Promise<Record<string, {source: string, installedAt: string, name: string}>>} */
export async function readLedger() {
  return readJson(path.join(stateDir(), LEDGER_FILE), {})
}

/**
 * @param {string} key `<rootId>/<dirName>`
 * @param {{source: string, name: string}} entry
 */
export async function rememberInstall(key, entry) {
  const ledger = await readLedger()
  ledger[key] = { ...entry, installedAt: new Date().toISOString() }
  await writeJson(path.join(stateDir(), LEDGER_FILE), ledger)
}

/** @param {string} key */
export async function forgetInstall(key) {
  const ledger = await readLedger()
  if (!(key in ledger)) return
  delete ledger[key]
  await writeJson(path.join(stateDir(), LEDGER_FILE), ledger)
}
