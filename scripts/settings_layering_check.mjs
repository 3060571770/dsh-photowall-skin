/**
 * Real-DOM regression for the 0.4.1 settings-modal layering fix.
 *
 * Spawns a headless Edge against the real DSH web instance, opens
 * Settings → 🎨 皮肤, and asserts that the settings panel owns the hit at the
 * dialog center (the region the conversation layer used to cover) and that
 * the injected skin CSS matches the 0.4.1 layering contract.
 *
 * Usage: node settings_layering_check.mjs [targetUrl] [edgePath] [debugPort]
 * Defaults: http://127.0.0.1:3080/ , the standard Edge path, port 9237.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEBUG_PORT = Number(process.argv[4] ?? 9237)
const TARGET = process.argv[2] ?? 'http://127.0.0.1:3080/'
const EDGE = process.argv[3] ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const profileDir = mkdtempSync(join(tmpdir(), 'pgs-layer-'))
const edge = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--window-size=1600,1000',
  'about:blank',
], { stdio: 'ignore' })

let socket
let sequence = 0
const pending = new Map()

function call(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails !== undefined) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  }
  return result.result.value
}

async function waitFor(expression, timeout = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error(`Timed out waiting for: ${expression}`)
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitForDebugPort(timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
      if (response.ok) return
    } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Edge debug port never came up')
}

async function main() {
  await waitForDebugPort()
  const targets = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then(r => r.json())
  const target = targets.find(entry => entry.type === 'page')
  if (!target?.webSocketDebuggerUrl) throw new Error('No debuggable page target')

  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data))
    if (message.id === undefined) return
    const waiter = pending.get(message.id)
    if (waiter === undefined) return
    pending.delete(message.id)
    if (message.error !== undefined) waiter.reject(new Error(message.error.message))
    else waiter.resolve(message.result)
  })

  await call('Page.enable')
  await call('Runtime.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await call('Page.navigate', { url: TARGET })
  await waitFor(`document.readyState === 'complete'`, 30_000)
  await waitFor(`document.querySelector('[data-photowall-skin-frame]') !== null`, 90_000)
  await sleep(1200)

  // Open Settings → 🎨 皮肤.
  const opened = await evaluate(`(() => {
    const trigger = document.querySelector('button[aria-haspopup="dialog"]')
    if (trigger == null) return false
    trigger.click()
    return true
  })()`)
  if (!opened) throw new Error('Settings trigger not found')
  await waitFor(`document.querySelector('[role="dialog"]') !== null`, 15_000)
  await sleep(500)
  const navClicked = await evaluate(`(() => {
    const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(x => (x.textContent || '').includes('皮肤'))
    if (b == null) return false
    b.click()
    return true
  })()`)
  if (!navClicked) throw new Error('Skin section nav not found')
  await waitFor(`document.querySelector('.pgs-page') !== null`, 15_000)
  await sleep(600)

  // Core regression: the settings panel must own the hit at the dialog center
  // (previously the conversation composer/messages painted above it).
  const dialogCenter = await evaluate(`(() => {
    const d = document.querySelector('[role="dialog"]')
    const r = d.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
  })()`)
  const centerHit = await evaluate(`(() => {
    const x = ${dialogCenter.x}
    const y = ${dialogCenter.y}
    const hit = document.elementFromPoint(x, y)
    const dlg = document.querySelector('[role="dialog"]')
    const pgs = document.querySelector('.pgs-page')
    return {
      point: [x, y],
      hitInsideDialog: dlg != null && dlg.contains(hit),
      hitInsidePgs: pgs != null && pgs.contains(hit),
      hitTag: hit == null ? null : hit.tagName,
      hitClass: hit == null ? null : (typeof hit.className === 'string' ? hit.className : ''),
    }
  })()`)

  // CSS contract: the injected stylesheet carries the 0.4.1 layering fix.
  const rawCss = await evaluate(`(() => {
    return document.querySelector('style[data-photowall-skin]')?.textContent ?? ''
  })()`)
  const colState = await evaluate(`(() => {
    const col = document.querySelector('[data-photowall-skin-frame] > div:first-child')
    const colCs = getComputedStyle(col)
    const before = getComputedStyle(col, '::before')
    return { colIsolation: colCs.isolation, beforeZ: before.zIndex }
  })()`)
  const cssContract = {
    hasFixComment: rawCss.includes('0.4.1 layering fix'),
    artboardZ2: /\.pgs-artboard\s*\{[^}]*z-index:\s*-2/.test(rawCss),
    colIsolation: colState.colIsolation,
    beforeZ: colState.beforeZ,
  }

  const report = {
    target: TARGET,
    dialogCenter,
    centerHit,
    cssContract,
    passed: centerHit.hitInsideDialog && centerHit.hitInsidePgs && cssContract.colIsolation === 'auto' && cssContract.beforeZ === '-1' && cssContract.artboardZ2 && cssContract.hasFixComment,
  }
  console.log(JSON.stringify(report, null, 2))
  socket.close()
  return report
}

let exitCode = 0
try {
  const report = await main()
  if (!report.passed) exitCode = 1
} catch (error) {
  console.error('LAYERING CHECK FAILED:', error)
  exitCode = 1
} finally {
  edge.kill()
  setTimeout(() => { rmSync(profileDir, { recursive: true, force: true }) }, 500).unref()
}
process.exit(exitCode)
