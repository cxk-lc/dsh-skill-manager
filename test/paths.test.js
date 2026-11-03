import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { assertSafeName, displayPath, resolveEntry, skillRoots } from '../lib/paths.js'
import { parseRepoInput } from '../lib/sources/github.js'

test('assertSafeName 只接受目录名形态', () => {
  assert.equal(assertSafeName('pdf-tools'), 'pdf-tools')
  assert.throws(() => assertSafeName('.system'), /不合法/)
  assert.throws(() => assertSafeName('../evil'), /不合法/)
  assert.throws(() => assertSafeName('a/b'), /不合法/)
  assert.throws(() => assertSafeName(''), /不合法/)
})

test('resolveEntry 拒绝穿越到根目录之外', () => {
  const root = path.join(process.cwd(), 'skills')
  assert.equal(resolveEntry(root, 'demo'), path.join(root, 'demo'))
  assert.throws(() => resolveEntry(root, '..'), /不合法/)
  assert.throws(() => resolveEntry(root, '..\\other'), /不合法/)
})

test('skillRoots 提供用户级与全局 agents 两个根', () => {
  const roots = skillRoots()
  assert.deepEqual(
    roots.map((root) => root.id),
    ['user', 'agents'],
  )
  assert.equal(roots[0].writable, true)
  assert.equal(roots[1].writable, true)
})

test('displayPath 用 ~ 缩写用户目录', () => {
  const target = path.join(process.env.USERPROFILE || process.env.HOME || '', '.dsh', 'skills')
  assert.match(displayPath(target), /^~\/\.dsh\/skills$/)
})

test('parseRepoInput 支持多种仓库写法', () => {
  assert.deepEqual(parseRepoInput('anthropics/skills'), {
    owner: 'anthropics',
    repo: 'skills',
    branch: '',
    path: '',
  })
  assert.deepEqual(parseRepoInput('https://github.com/anthropics/skills'), {
    owner: 'anthropics',
    repo: 'skills',
    branch: '',
    path: '',
  })
  assert.deepEqual(parseRepoInput('https://github.com/openclaw/openclaw/tree/main/skills/nano-pdf'), {
    owner: 'openclaw',
    repo: 'openclaw',
    branch: 'main',
    path: 'skills/nano-pdf',
  })
  assert.deepEqual(parseRepoInput('https://github.com/o/r/blob/main/skills/x/SKILL.md'), {
    owner: 'o',
    repo: 'r',
    branch: 'main',
    path: 'skills/x',
  })
  assert.deepEqual(parseRepoInput('o/r@dev'), { owner: 'o', repo: 'r', branch: 'dev', path: '' })
  assert.throws(() => parseRepoInput(''), /请填写/)
  assert.throws(() => parseRepoInput('https://github.com/only-owner'), /缺少仓库名/)
  assert.throws(() => parseRepoInput('bad owner/repo'), /不合法/)
})
