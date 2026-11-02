import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildZip } from './helpers/zip-writer.js'

const root = await mkdtemp(path.join(tmpdir(), 'dsm-test-'))
process.env.DSH_HOME = path.join(root, 'dsh')
process.env.DSH_AGENTS_HOME = path.join(root, 'agents')

const { installSkill, uninstallSkill } = await import('../lib/install.js')
const { listInstalled } = await import('../lib/registry.js')

const zipResponse = (files) =>
  new Response(buildZip(files), { status: 200, headers: { 'content-type': 'application/zip' } })

const realFetch = globalThis.fetch
test.after(async () => {
  globalThis.fetch = realFetch
  await rm(root, { recursive: true, force: true })
})

const skillMd = (name, description) => `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`

test('从 SkillHub 包装入并写入用户级目录', async () => {
  globalThis.fetch = async () => zipResponse({ 'SKILL.md': skillMd('demo-skill', 'a demo'), 'scripts/a.py': 'print(1)' })
  const result = await installSkill({ spec: { kind: 'skillhub', slug: 'demo-skill' } })
  assert.equal(result.name, 'demo-skill')
  const target = path.join(process.env.DSH_HOME, 'skills', 'demo-skill')
  const text = await readFile(path.join(target, 'SKILL.md'), 'utf8')
  assert.match(text, /demo-skill/)
  assert.equal(result.files, 2)
})

test('重复安装返回 EEXIST，覆盖后才替换', async () => {
  globalThis.fetch = async () => zipResponse({ 'SKILL.md': skillMd('demo-skill', 'second version') })
  await assert.rejects(
    () => installSkill({ spec: { kind: 'skillhub', slug: 'demo-skill' } }),
    (err) => err.code === 'EEXIST',
  )
  const overwritten = await installSkill({ spec: { kind: 'skillhub', slug: 'demo-skill' }, overwrite: true })
  assert.equal(overwritten.name, 'demo-skill')
  const dir = path.join(process.env.DSH_HOME, 'skills', 'demo-skill')
  const text = await readFile(path.join(dir, 'SKILL.md'), 'utf8')
  assert.match(text, /second version/)
  const leftovers = (await readdir(path.join(process.env.DSH_HOME, 'skills'))).filter((name) => name.startsWith('.tmp-'))
  assert.deepEqual(leftovers, [])
})

test('缺少 SKILL.md 的包被拒绝', async () => {
  globalThis.fetch = async () => zipResponse({ 'README.md': 'no skill here' })
  await assert.rejects(() => installSkill({ spec: { kind: 'skillhub', slug: 'broken' } }), /没有 SKILL.md/)
})

test('frontmatter 非法时拒绝安装且不落盘', async () => {
  globalThis.fetch = async () => zipResponse({ 'SKILL.md': '---\nname: Bad Name\ndescription: x\n---\n' })
  await assert.rejects(() => installSkill({ spec: { kind: 'skillhub', slug: 'bad' } }), /不合法/)
  const entries = await readdir(path.join(process.env.DSH_HOME, 'skills')).catch(() => [])
  assert.ok(!entries.includes('Bad Name'))
})

test('GitHub 子目录安装会剥离仓库前缀与技能目录', async () => {
  globalThis.fetch = async (url) => {
    assert.match(String(url), /codeload\.github\.com\/octo\/repo-a\/zip\/refs\/heads\/main/)
    return zipResponse({
      'repo-a-main/README.md': '# repo',
      'repo-a-main/skills/pdf-helper/SKILL.md': skillMd('pdf-helper', 'pdf helper'),
      'repo-a-main/skills/pdf-helper/ref/x.md': 'ref',
    })
  }
  const result = await installSkill({
    spec: { kind: 'github', owner: 'octo', repo: 'repo-a', branch: 'main', path: 'skills/pdf-helper' },
  })
  assert.equal(result.name, 'pdf-helper')
  const dir = path.join(process.env.DSH_HOME, 'skills', 'pdf-helper')
  assert.equal((await stat(path.join(dir, 'ref', 'x.md'))).isFile(), true)
  assert.equal((await stat(path.join(dir, 'README.md')).catch(() => null)) === null, true)
})

test('已安装列表能读到新装的技能并带上来源', async () => {
  const items = await listInstalled()
  const names = items.map((item) => item.name)
  assert.ok(names.includes('demo-skill'))
  assert.ok(names.includes('pdf-helper'))
  const demo = items.find((item) => item.name === 'demo-skill')
  assert.equal(demo.rootId, 'user')
  assert.match(demo.source, /SkillHub/)
  assert.ok(demo.files >= 1)
})

test('卸载删除目录并移出列表', async () => {
  const result = await uninstallSkill({ rootId: 'user', dirName: 'demo-skill' })
  assert.match(result.path, /demo-skill$/)
  const dir = path.join(process.env.DSH_HOME, 'skills', 'demo-skill')
  assert.equal(await stat(dir).catch(() => null), null)
  const items = await listInstalled()
  assert.ok(!items.some((item) => item.name === 'demo-skill'))
})

test('卸载不存在的技能报错而非静默成功', async () => {
  await assert.rejects(() => uninstallSkill({ rootId: 'user', dirName: 'not-there' }), /没有找到/)
})

test('卸载拒绝越界目录名', async () => {
  await assert.rejects(() => uninstallSkill({ rootId: 'user', dirName: '../etc' }), /不合法/)
  await assert.rejects(() => uninstallSkill({ rootId: 'other', dirName: 'x' }), /未知的技能目录/)
})

test('读取平铺 .md 形式的技能', async () => {
  const dir = path.join(process.env.DSH_AGENTS_HOME, 'skills')
  await import('node:fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }))
  await writeFile(path.join(dir, 'flat-skill.md'), '---\nname: flat-skill\ndescription: flat file skill\n---\n')
  const items = await listInstalled()
  const flat = items.find((item) => item.name === 'flat-skill')
  assert.ok(flat)
  assert.equal(flat.rootId, 'agents')
  assert.equal(flat.kind, 'file')
  await uninstallSkill({ rootId: 'agents', dirName: 'flat-skill' })
  const after = await listInstalled()
  assert.ok(!after.some((item) => item.name === 'flat-skill'))
})
