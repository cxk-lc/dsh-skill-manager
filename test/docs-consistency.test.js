import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const clientPath = new URL('../lib/client.js', import.meta.url)
const docPath = new URL('../docs/credentials.md', import.meta.url)

/** Slice one locale dictionary out of client.js (zh block ends where en begins). */
function dictionarySlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  assert.ok(start >= 0, `找不到字典起点 ${startMarker}`)
  const end = source.indexOf(endMarker, start)
  assert.ok(end > start, `找不到字典终点 ${endMarker}`)
  return source.slice(start, end)
}

function stringValue(slice, key) {
  const match = new RegExp(key + ":\\s*'((?:[^'\\\\]|\\\\.)*)'").exec(slice)
  assert.ok(match, `字典里缺少 ${key}`)
  return match[1].replace(/\\n/g, '\n').replace(/\\'/g, "'")
}

/** Pull the §6 blockquotes in document order. */
function docQuotes(markdown) {
  const section = markdown.split('## 6.')[1]
  assert.ok(section, '凭证文档缺少第 6 节')
  const blocks = []
  let current = []
  for (const line of section.split(/\r?\n/)) {
    if (line.startsWith('> ')) {
      current.push(line.slice(2))
    } else if (current.length) {
      blocks.push(current.join('\n'))
      current = []
    }
  }
  if (current.length) blocks.push(current.join('\n'))
  return blocks
}

test('设置页 tooltip 文案与 docs/credentials.md 第 6 节完全一致', async () => {
  const client = await readFile(clientPath, 'utf8')
  const doc = await readFile(docPath, 'utf8')
  const zh = dictionarySlice(client, 'const zh = {', 'const en = {')
  const quotes = docQuotes(doc)
  assert.equal(quotes.length, 2, '第 6 节应有两段提示原文')
  assert.equal(stringValue(zh, 'tipGithub'), quotes[0])
  assert.equal(stringValue(zh, 'tipSkillsmp'), quotes[1])
})

test('凭证文档包含 README 指向它的相对链接目标', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  assert.match(readme, /\(docs\/credentials\.md\)/, 'README 缺少指向 docs/credentials.md 的链接')
})

test('凭证文档涵盖两项配置的获取、额度与安全说明', async () => {
  const doc = await readFile(docPath, 'utf8')
  for (const needle of [
    'personal-access-tokens/new',
    'Public repositories (read-only)',
    '5,000 次/小时',
    'skillsmp.com/docs/api',
    'sk_live_',
    '50 次/天',
    '0600',
  ]) {
    assert.ok(doc.includes(needle), `文档缺少关键信息：${needle}`)
  }
})
