// Headless Chrome driver over CDP: navigate, collect console/errors, evaluate JS, screenshot.
// Zero deps (Node 22+ global fetch + WebSocket). Usage:
//   node tools/browse.mjs <url> [--out shot.png] [--wait 3000] [--eval "expr"] [--width 1440] [--height 1000]
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = Number(process.env.CDP_PORT || 9223)

const args = process.argv.slice(2)
const url = args[0]
const flag = (name, def) => {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : def
}
const outPath = flag('out')
const waitMs = Number(flag('wait', 3500))
const evalExpr = flag('eval')
const width = Number(flag('width', 1440))
const height = Number(flag('height', 1000))
const injectFile = flag('inject')
const keepOpen = args.includes('--keep')

if (!url) {
  console.error('usage: node tools/browse.mjs <url> [--out file.png] [--wait ms] [--eval expr]')
  process.exit(2)
}

const profile = await mkdtemp(join(tmpdir(), 'cdp-profile-'))
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    '--window-size=' + width + ',' + height,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(fn, timeoutMs, stepMs = 250) {
  const end = Date.now() + timeoutMs
  let lastErr
  while (Date.now() < end) {
    try {
      const v = await fn()
      if (v) return v
    } catch (err) {
      lastErr = err
    }
    await sleep(stepMs)
  }
  throw lastErr || new Error('timeout')
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.listeners = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
        return
      }
      for (const fn of this.listeners) fn(msg)
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }
  on(fn) {
    this.listeners.push(fn)
  }
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    ws.addEventListener('open', () => resolve(new Cdp(ws)))
    ws.addEventListener('error', (e) => reject(new Error('ws error')))
  })
}

const logs = []
let exitCode = 0

try {
  await waitFor(async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
    return res.ok
  }, 20000)

  const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
  const target = await connect(version.webSocketDebuggerUrl)
  await target.send('Target.createTarget', { url: 'about:blank' })
  const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`)
  const pageTarget = (await listRes.json()).find((t) => t.type === 'page')
  const page = await connect(pageTarget.webSocketDebuggerUrl)
  target.ws.close()

  page.on((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || [])
        .map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type))
        .join(' ')
      logs.push(`[console.${msg.params.type}] ${text}`)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      logs.push(`[exception] ${d.exception?.description || d.text}`)
    } else if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry
      if (e.level === 'error' || e.level === 'warning') logs.push(`[log.${e.level}] ${e.text}`)
    }
  })

  await page.send('Runtime.enable')
  await page.send('Log.enable')
  await page.send('Page.enable')
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  })
  if (injectFile) {
    const source = await readFile(injectFile, 'utf8')
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source })
  }
  await page.send('Page.navigate', { url })
  await sleep(waitMs)

  if (evalExpr) {
    const res = await page.send('Runtime.evaluate', {
      expression: evalExpr,
      returnByValue: true,
      awaitPromise: true,
    })
    console.log('EVAL ' + JSON.stringify(res.result?.value ?? res.result?.description ?? null, null, 2))
    if (res.exceptionDetails) console.log('EVAL_ERROR ' + JSON.stringify(res.exceptionDetails.exception?.description))
  }

  if (outPath) {
    const shot = await page.send('Page.captureScreenshot', { format: 'png' })
    await writeFile(outPath, Buffer.from(shot.data, 'base64'))
    console.log('SHOT ' + outPath)
  }

  console.log('--- console (' + logs.length + ') ---')
  for (const line of logs) console.log(line)

  if (keepOpen) {
    console.log('CHROME_PORT ' + PORT)
    await new Promise(() => {})
  }
} catch (err) {
  console.error('BROWSE_ERROR ' + (err && err.message))
  exitCode = 1
} finally {
  if (!keepOpen) {
    try {
      chrome.kill()
    } catch {}
    await sleep(500)
    await rm(profile, { recursive: true, force: true }).catch(() => {})
  }
  process.exit(exitCode)
}
