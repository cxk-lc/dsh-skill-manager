import test from 'node:test'
import assert from 'node:assert/strict'
import { buildZip } from './helpers/zip-writer.js'

const { looksLikeRepoRef, latestRelease, searchGithub } = await import('../lib/sources/github.js')

const realFetch = globalThis.fetch
test.after(() => {
  globalThis.fetch = realFetch
})

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })

const text = (value) => new Response(value, { status: 200, headers: { 'content-type': 'text/plain' } })

const zip = (files) => new Response(buildZip(files), { status: 200, headers: { 'content-type': 'application/zip' } })

const skillMd = (name, description) => `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`

function mockFetch(routes) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    const target = String(url)
    calls.push(target)
    for (const [pattern, handler] of routes) {
      if (pattern.test(target)) return handler(target, options)
    }
    return new Response('not found', { status: 404 })
  }
  return calls
}

test('looksLikeRepoRef 区分仓库引用与 skill 名称', () => {
  assert.equal(looksLikeRepoRef('anthropics/skills'), true)
  assert.equal(looksLikeRepoRef('https://github.com/o/r/tree/main/skills/x'), true)
  assert.equal(looksLikeRepoRef('pdf-helper'), false)
  assert.equal(looksLikeRepoRef('  周报  '), false)
  assert.equal(looksLikeRepoRef(''), false)
})

test('latestRelease 返回 tag 并缓存，避免重复请求', async () => {
  const calls = mockFetch([
    [
      /api\.github\.com\/repos\/acme\/cache-kit\/releases\/latest$/,
      () => json({ tag_name: 'v2.3.4', name: 'v2.3.4', html_url: 'https://x', published_at: '2026-01-02T00:00:00Z' }),
    ],
  ])
  const first = await latestRelease({ owner: 'acme', repo: 'cache-kit' })
  const second = await latestRelease({ owner: 'acme', repo: 'cache-kit' })
  assert.equal(first.tag, 'v2.3.4')
  assert.equal(second.tag, 'v2.3.4')
  assert.equal(calls.length, 1, '第二次应命中缓存')
})

test('latestRelease 对没有 release 的仓库返回 null 且不抛错', async () => {
  mockFetch([[/releases\/latest$/, () => json({ message: 'Not Found' }, 404)]])
  const release = await latestRelease({ owner: 'acme', repo: 'no-release' })
  assert.equal(release, null)
})

test('按名称搜索走代码搜索，并带上仓库最新 release', async () => {
  const calls = mockFetch([
    [
      /api\.github\.com\/search\/code/,
      () =>
        json({
          items: [
            { repository: { full_name: 'acme/kit' }, path: 'skills/pdf-helper/SKILL.md' },
            { repository: { full_name: 'acme/kit' }, path: 'skills/other/SKILL.md' },
          ],
        }),
    ],
    [
      /raw\.githubusercontent\.com\/acme\/kit\/HEAD\/skills\/pdf-helper\/SKILL\.md$/,
      () => text(skillMd('pdf-helper', 'PDF helper')),
    ],
    [
      /raw\.githubusercontent\.com\/acme\/kit\/HEAD\/skills\/other\/SKILL\.md$/,
      () => text(skillMd('other-skill', 'unrelated')),
    ],
    [/api\.github\.com\/repos\/acme\/kit\/releases\/latest$/, () => json({ tag_name: 'v1.2.0', html_url: 'https://x' })],
  ])

  const result = await searchGithub({ input: 'pdf-helper', token: 'tkn' })
  assert.equal(result.mode, 'name')
  assert.equal(result.items.length, 1, '只保留名称匹配的结果')
  assert.equal(result.items[0].name, 'pdf-helper')
  assert.equal(result.items[0].release.tag, 'v1.2.0')
  assert.deepEqual(result.items[0].spec, {
    kind: 'github',
    owner: 'acme',
    repo: 'kit',
    branch: '',
    path: 'skills/pdf-helper',
  })
  assert.ok(calls.some((url) => url.includes('search/code')), '应调用代码搜索')
})

test('仓库引用仍走扫描路径，并为卡片补充 release 版本', async () => {
  mockFetch([
    [/api\.github\.com\/repos\/octo\/skillpack$/, () => json({ default_branch: 'main', stargazers_count: 3 })],
    [
      /codeload\.github\.com\/octo\/skillpack\/zip/,
      () =>
        zip({
          'skillpack-main/skills/alpha/SKILL.md': skillMd('alpha', 'first'),
          'skillpack-main/skills/beta/SKILL.md': skillMd('beta', 'second'),
        }),
    ],
    [
      /api\.github\.com\/repos\/octo\/skillpack\/releases\/latest$/,
      () => json({ tag_name: 'v0.9.0', html_url: 'https://x' }),
    ],
  ])

  const result = await searchGithub({ input: 'octo/skillpack' })
  assert.equal(result.mode, 'repo')
  assert.equal(result.items.length, 2)
  assert.ok(result.items.every((item) => item.release.tag === 'v0.9.0'))
})

test('无 Token 时通过注入索引回退，只保留名称匹配的 GitHub 结果', async () => {
  mockFetch([[/api\.github\.com\/repos\/acme\/idx\/releases\/latest$/, () => json({ message: 'Not Found' }, 404)]])
  const result = await searchGithub({
    input: 'pdf-helper',
    fallbackIndex: async () => [
      {
        name: 'pdf-helper',
        description: 'PDF helper',
        spec: { kind: 'github', owner: 'acme', repo: 'idx', branch: '', path: 'skills/pdf-helper' },
        url: 'https://example.test/pdf-helper',
      },
      {
        name: 'other-skill',
        description: 'unrelated',
        spec: { kind: 'github', owner: 'acme', repo: 'idx', branch: '', path: 'skills/other' },
        url: '',
      },
    ],
  })
  assert.equal(result.mode, 'name')
  assert.equal(result.noteCode, 'index-fallback')
  assert.equal(result.items.length, 1, '只保留名称匹配的项')
  assert.equal(result.items[0].name, 'pdf-helper')
  assert.equal(result.items[0].platform, 'github')
  assert.equal(result.items[0].spec.path, 'skills/pdf-helper')
})

test('没有索引也没有 Token 时返回 token-required，且不发网络请求', async () => {
  const calls = mockFetch([])
  const result = await searchGithub({ input: 'pdf-helper' })
  assert.equal(result.items.length, 0)
  assert.equal(result.noteCode, 'token-required')
  assert.equal(calls.length, 0)
})
