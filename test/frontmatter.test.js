import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter, readBoolean, validateSkillMeta } from '../lib/frontmatter.js'

test('解析基础 frontmatter 与正文', () => {
  const { data, body, hasFrontmatter } = parseFrontmatter(
    ['---', 'name: pdf-tools', 'description: Work with PDFs', 'version: "1.2.0"', '---', '# Title', 'body'].join('\n'),
  )
  assert.equal(hasFrontmatter, true)
  assert.equal(data.name, 'pdf-tools')
  assert.equal(data.description, 'Work with PDFs')
  assert.equal(data.version, '1.2.0')
  assert.match(body, /# Title/)
})

test('没有 frontmatter 时整体作为正文', () => {
  const { data, hasFrontmatter, body } = parseFrontmatter('# just markdown')
  assert.equal(hasFrontmatter, false)
  assert.deepEqual(data, {})
  assert.equal(body, '# just markdown')
})

test('解析块标量与折叠标量', () => {
  const literal = parseFrontmatter(['---', 'name: a', 'description: |', '  第一行', '  第二行', '---', 'x'].join('\n'))
  assert.equal(literal.data.description, '第一行\n第二行')

  const folded = parseFrontmatter(['---', 'name: a', 'description: >-', '  one', '  two', '---', 'x'].join('\n'))
  assert.equal(folded.data.description, 'one two')
})

test('忽略嵌套映射而不误读其内部键', () => {
  const { data } = parseFrontmatter(
    ['---', 'name: nested', 'metadata:', '  openclaw:', '    requires: node', 'description: ok', '---'].join('\n'),
  )
  assert.equal(data.name, 'nested')
  assert.equal(data.description, 'ok')
  assert.equal(data.requires, undefined)
})

test('去除行尾注释但保留引号内内容', () => {
  const plain = parseFrontmatter(['---', 'name: a', 'description: value # comment', '---'].join('\n'))
  assert.equal(plain.data.description, 'value')
  const quoted = parseFrontmatter(['---', 'name: a', 'description: "value # not comment"', '---'].join('\n'))
  assert.equal(quoted.data.description, 'value # not comment')
})

test('validateSkillMeta 校验必填与命名规范', () => {
  assert.deepEqual(
    validateSkillMeta({ name: 'pdf-tools', description: ' do things ' }, 'fallback').name,
    'pdf-tools',
  )
  assert.throws(() => validateSkillMeta({ description: 'x' }), /缺少 name/)
  assert.throws(() => validateSkillMeta({ name: 'Bad Name', description: 'x' }), /不合法/)
  assert.throws(() => validateSkillMeta({ name: 'ok-name' }), /缺少 description/)
})

test('readBoolean 接受 DSH 认可的布尔写法', () => {
  assert.equal(readBoolean('TRUE'), true)
  assert.equal(readBoolean('no'), false)
  assert.equal(readBoolean('0'), false)
  assert.equal(readBoolean(undefined), undefined)
  assert.equal(readBoolean('maybe'), undefined)
})
