/**
 * Read-only discovery of what is already installed under the two managed roots.
 * Mirrors the harness's own rules: `<name>/SKILL.md` bundles or flat `<name>.md`
 * files, dot-directories ignored, frontmatter validated but never fatal here.
 * @module dsh-skill-manager/registry
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseFrontmatter, readBoolean } from './frontmatter.js'
import { displayPath, skillRoots } from './paths.js'
import { readLedger } from './config.js'

const MAX_COUNTED_FILES = 400

async function countFiles(dir) {
  let total = 0
  const queue = [dir]
  while (queue.length && total < MAX_COUNTED_FILES) {
    const current = queue.shift()
    let entries = []
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) queue.push(path.join(current, entry.name))
      else if (entry.isFile()) total += 1
      if (total >= MAX_COUNTED_FILES) break
    }
  }
  return total
}

async function describe(entryPath, meta) {
  const stats = await stat(entryPath).catch(() => null)
  return {
    files: stats && stats.isDirectory() ? await countFiles(entryPath) : 1,
    updatedAt: stats ? stats.mtime.toISOString() : null,
  }
}

/**
 * @returns {Promise<Array<object>>} every installed skill across both roots.
 */
export async function listInstalled() {
  const ledger = await readLedger().catch(() => ({}))
  const items = []

  for (const root of skillRoots()) {
    let entries = []
    try {
      entries = await readdir(root.path, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const entryPath = path.join(root.path, entry.name)
      let skillFile = null
      let kind = 'dir'
      if (entry.isDirectory()) {
        skillFile = path.join(entryPath, 'SKILL.md')
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        skillFile = entryPath
        kind = 'file'
      } else {
        continue
      }

      let text = ''
      try {
        text = await readFile(skillFile, 'utf8')
      } catch {
        continue
      }
      const { data } = parseFrontmatter(text)
      const fallback = kind === 'file' ? entry.name.replace(/\.md$/i, '') : entry.name
      const name = String(data.name || fallback).trim() || fallback
      const description = String(data.description || '').replace(/\s+/g, ' ').trim()
      const extra = await describe(entryPath, data)
      const ledgerKey = `${root.id}/${entry.name}`

      items.push({
        name,
        dirName: entry.name,
        description,
        version: data.version ? String(data.version).trim() : '',
        rootId: root.id,
        rootLabel: root.label,
        rootPath: displayPath(root.path),
        path: displayPath(entryPath),
        kind,
        files: extra.files,
        updatedAt: extra.updatedAt,
        modelInvocable: readBoolean(data['disable-model-invocation']) !== true,
        userInvocable: readBoolean(data['user-invocable']) !== false,
        source: ledger[ledgerKey]?.source || '',
        installedAt: ledger[ledgerKey]?.installedAt || '',
      })
    }
  }

  // User-level first, then the shared agents root; alphabetical inside a root.
  const rank = { user: 0, agents: 1 }
  items.sort(
    (a, b) =>
      (rank[a.rootId] ?? 9) - (rank[b.rootId] ?? 9) ||
      a.name.localeCompare(b.name) ||
      a.rootId.localeCompare(b.rootId),
  )
  return items
}
