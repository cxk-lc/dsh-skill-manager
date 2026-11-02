/**
 * Minimal zip reader: central directory first, then each entry's local header.
 * Only what the skill sources produce (store / deflate), with hard ceilings so a
 * hostile archive cannot exhaust memory.
 * @module dsh-skill-manager/zip
 */
import { inflateRawSync } from 'node:zlib'

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

export const ZIP_MAX_ENTRIES = 5000
export const ZIP_MAX_TOTAL_BYTES = 200 * 1024 * 1024

const METHOD_STORE = 0
const METHOD_DEFLATE = 8

/** @param {Buffer} buf */
function findEndOfCentralDirectory(buf) {
  if (buf.length < 22) return -1
  const earliest = Math.max(0, buf.length - 22 - 0xffff)
  for (let i = buf.length - 22; i >= earliest; i -= 1) {
    if (buf.readUInt32LE(i) !== SIG_EOCD) continue
    const commentLength = buf.readUInt16LE(i + 20)
    if (i + 22 + commentLength === buf.length) return i
  }
  return -1
}

/**
 * Expand a zip archive into `{ path: Buffer }`.
 * @param {Buffer} buf
 * @returns {Record<string, Buffer>}
 */
export function unzip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('不是有效的 zip 包（文件过小）')
  const eocd = findEndOfCentralDirectory(buf)
  if (eocd < 0) throw new Error('不是有效的 zip 包（找不到中央目录）')

  const entryCount = buf.readUInt16LE(eocd + 10)
  let cursor = buf.readUInt32LE(eocd + 16)
  if (entryCount > ZIP_MAX_ENTRIES) throw new Error(`zip 条目过多（${entryCount}），已拒绝解包`)
  if (cursor >= buf.length) throw new Error('zip 中央目录偏移越界')

  const files = {}
  let total = 0
  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== SIG_CENTRAL) {
      throw new Error('zip 中央目录损坏')
    }
    const method = buf.readUInt16LE(cursor + 10)
    const compressedSize = buf.readUInt32LE(cursor + 20)
    const uncompressedSize = buf.readUInt32LE(cursor + 24)
    const nameLength = buf.readUInt16LE(cursor + 28)
    const extraLength = buf.readUInt16LE(cursor + 30)
    const commentLength = buf.readUInt16LE(cursor + 32)
    const localOffset = buf.readUInt32LE(cursor + 42)
    const name = buf.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    cursor += 46 + nameLength + extraLength + commentLength

    if (!name || name.endsWith('/')) continue
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error('不支持 ZIP64 格式的技能包')
    }
    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== SIG_LOCAL) {
      throw new Error(`zip 条目损坏：${name}`)
    }
    const localNameLength = buf.readUInt16LE(localOffset + 26)
    const localExtraLength = buf.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > buf.length) throw new Error(`zip 条目被截断：${name}`)

    const compressed = buf.subarray(dataStart, dataEnd)
    let data
    if (method === METHOD_STORE) {
      data = Buffer.from(compressed)
    } else if (method === METHOD_DEFLATE) {
      try {
        data = inflateRawSync(compressed)
      } catch {
        throw new Error(`zip 解压失败：${name}`)
      }
    } else {
      throw new Error(`不支持的 zip 压缩方式：${method}`)
    }

    total += data.length
    if (total > ZIP_MAX_TOTAL_BYTES) throw new Error('zip 解包后体积超过上限，已中止')
    if (uncompressedSize && data.length !== uncompressedSize) {
      throw new Error(`zip 条目长度不符：${name}`)
    }
    files[normalizeEntryPath(name)] = data
  }

  if (!Object.keys(files).length) throw new Error('zip 内没有任何文件')
  return files
}

/**
 * Reject absolute paths and traversal segments before anything touches disk.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeEntryPath(raw) {
  const path = String(raw).replace(/\\/g, '/').replace(/^\.\//, '')
  if (!path || path.startsWith('/') || /^[a-zA-Z]:/.test(path)) throw new Error(`zip 内含非法路径：${raw}`)
  const parts = path.split('/')
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new Error(`zip 内含非法路径：${raw}`)
  }
  return parts.join('/')
}

/**
 * Strip the single wrapper directory archives from GitHub carry (`repo-branch/`).
 * @param {Record<string, Buffer>} files
 * @returns {Record<string, Buffer>}
 */
export function stripSingleRoot(files) {
  const names = Object.keys(files)
  const roots = new Set(names.map((name) => name.split('/')[0]))
  if (roots.size !== 1) return files
  const [root] = [...roots]
  if (!names.every((name) => name.includes('/'))) return files
  const out = {}
  for (const [name, body] of Object.entries(files)) out[name.slice(root.length + 1)] = body
  return out
}
