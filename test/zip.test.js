import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEntryPath, stripSingleRoot, unzip } from '../lib/zip.js'
import { buildZip } from './helpers/zip-writer.js'

test('unzip 读取中央目录并还原文件内容', () => {
  const zip = buildZip({
    'SKILL.md': '# demo\n\nhello',
    'scripts/run.py': 'print(1)\n',
  })
  const files = unzip(zip)
  assert.equal(Object.keys(files).length, 2)
  assert.equal(files['SKILL.md'].toString('utf8'), '# demo\n\nhello')
  assert.equal(files['scripts/run.py'].toString('utf8'), 'print(1)\n')
})

test('unzip 拒绝非 zip 输入', () => {
  assert.throws(() => unzip(Buffer.from('not a zip at all, definitely')), /不是有效的 zip 包/)
})

test('unzip 拒绝截断的归档', () => {
  const zip = buildZip({ 'SKILL.md': 'x'.repeat(100) })
  const truncated = zip.subarray(0, zip.length - 40)
  assert.throws(() => unzip(truncated), /zip/)
})

test('normalizeEntryPath 拒绝越界与绝对路径', () => {
  assert.equal(normalizeEntryPath('./a/b.md'), 'a/b.md')
  assert.equal(normalizeEntryPath('a\\b.md'), 'a/b.md')
  assert.throws(() => normalizeEntryPath('../evil.md'), /非法路径/)
  assert.throws(() => normalizeEntryPath('a/../../evil.md'), /非法路径/)
  assert.throws(() => normalizeEntryPath('/etc/passwd'), /非法路径/)
  assert.throws(() => normalizeEntryPath('C:/windows/system32'), /非法路径/)
})

test('stripSingleRoot 剥离唯一的顶层目录', () => {
  const files = { 'repo-main/SKILL.md': Buffer.from('a'), 'repo-main/x/y.txt': Buffer.from('b') }
  assert.deepEqual(Object.keys(stripSingleRoot(files)).sort(), ['SKILL.md', 'x/y.txt'])
})

test('stripSingleRoot 在根级已有文件时保持原样', () => {
  const files = { 'SKILL.md': Buffer.from('a'), 'sub/x.txt': Buffer.from('b') }
  assert.deepEqual(Object.keys(stripSingleRoot(files)).sort(), ['SKILL.md', 'sub/x.txt'])
})
