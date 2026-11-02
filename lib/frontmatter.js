/**
 * A deliberately small YAML-frontmatter reader: enough for SKILL.md headers
 * (plain / quoted / block scalars) without pulling a YAML parser into the
 * plugin. Nested mappings are recognized and ignored rather than mis-parsed.
 * @module dsh-skill-manager/frontmatter
 */

/**
 * Split a SKILL.md into frontmatter data and body.
 * @param {string} text
 * @returns {{data: Record<string,string>, body: string, hasFrontmatter: boolean}}
 */
export function parseFrontmatter(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source)
  if (!match) return { data: {}, body: source, hasFrontmatter: false }
  return {
    data: parseTopLevel(match[1]),
    body: source.slice(match[0].length),
    hasFrontmatter: true,
  }
}

function indentOf(line) {
  const match = /^[ \t]*/.exec(line)
  return match ? match[0].length : 0
}

function isSkippable(line) {
  const trimmed = line.trim()
  return trimmed === '' || trimmed.startsWith('#')
}

/**
 * Parse the frontmatter block's top-level keys only.
 * @param {string} block
 * @returns {Record<string,string>}
 */
function parseTopLevel(block) {
  const lines = block.split(/\r?\n/)
  const data = {}
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (isSkippable(line) || indentOf(line) > 0) continue
    const match = /^([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(line)
    if (!match) continue
    const key = match[1]
    const rest = match[2]
    if (rest === '' || rest.startsWith('#')) {
      // Nested mapping or empty value: consume its indented block, record nothing.
      let j = i + 1
      while (j < lines.length && (lines[j].trim() === '' || indentOf(lines[j]) > 0)) j += 1
      i = j - 1
      continue
    }
    if (/^[|>][+-]?[0-9]?[ \t]*$/.test(rest)) {
      const folded = rest[0] === '>'
      const chomp = /-/.test(rest) ? 'strip' : /\+/.test(rest) ? 'keep' : 'clip'
      const bodyLines = []
      let j = i + 1
      let minIndent = Infinity
      for (; j < lines.length; j += 1) {
        const next = lines[j]
        if (next.trim() === '') {
          bodyLines.push('')
          continue
        }
        const indent = indentOf(next)
        if (indent === 0) break
        minIndent = Math.min(minIndent, indent)
        bodyLines.push(next)
      }
      const indent = Number.isFinite(minIndent) ? minIndent : 0
      let text = bodyLines
        .map((entry) => (entry === '' ? '' : entry.slice(Math.min(indent, indentOf(entry)))))
        .join('\n')
      if (folded) text = foldLines(text)
      if (chomp === 'strip') text = text.replace(/\n+$/, '')
      else if (chomp === 'clip') text = text.replace(/\n+$/, '\n')
      data[key] = text.replace(/\s+$/, '')
      i = j - 1
      continue
    }
    data[key] = unquote(rest)
  }
  return data
}

function unquote(raw) {
  let value = raw.trim()
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value)
  if (quoted) {
    const inner = quoted[2]
    if (quoted[1] === '"') return inner.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    return inner.replace(/''/g, "'")
  }
  // Strip a trailing comment only when it is preceded by whitespace.
  value = value.replace(/[ \t]+#.*$/, '')
  return value.trim()
}

/**
 * Fold a `>` block scalar: single newlines become spaces, blank lines a newline.
 * @param {string} text
 * @returns {string}
 */
function foldLines(text) {
  return text
    .split('\n')
    .reduce((acc, line) => {
      if (line === '') return acc + '\n'
      if (acc === '' || acc.endsWith('\n')) return acc + line
      return acc + ' ' + line
    }, '')
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

/**
 * Validate the fields the DSH skill provider would validate, so an install never
 * creates a directory the harness will silently skip.
 * @param {Record<string,string>} data
 * @param {string} [fallbackName]
 * @returns {{name: string, description: string, version?: string, warnings: string[]}}
 */
export function validateSkillMeta(data, fallbackName) {
  const warnings = []
  const rawName = String(data.name || fallbackName || '').trim()
  const description = String(data.description || '').replace(/\s+/g, ' ').trim()
  if (!rawName) throw new Error('SKILL.md 缺少 name 字段')
  if (!NAME_PATTERN.test(rawName)) throw new Error(`SKILL.md 的 name 不合法（需为 kebab-case）：${rawName}`)
  if (!description) throw new Error('SKILL.md 缺少 description 字段')
  if (description.length > 1024) warnings.push('description 超过 1024 字符，DSH 可能截断展示')
  return { name: rawName, description, version: data.version ? String(data.version).trim() : '', warnings }
}

/**
 * Read the ASCII boolean forms DSH accepts for invocation keys.
 * @param {unknown} value
 * @returns {boolean|undefined}
 */
export function readBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined
  const text = String(value).trim().toLowerCase()
  if (['true', 'yes', 'on', '1'].includes(text)) return true
  if (['false', 'no', 'off', '0'].includes(text)) return false
  return undefined
}
