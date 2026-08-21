/**
 * Real-DOM regression for the composer-fade fix (hero↔active self-heal + fade
 * transitions). Spawns a headless Edge against the DSH web instance and asserts:
 *
 *   1. The injected CSS carries the hero `background-color` transition, the
 *      `.pgs-composer-fade` opacity transition and its `[data-visible]` rule.
 *   2. With `prefers-reduced-motion: reduce` emulated, both transitions
 *      resolve to `0s` (no animation).
 *   3. In an `active` session the fade has a positive box and `data-visible`.
 *   4. A hero→active round trip (real "new session" click + switch-back to a
 *      previous session row when one exists, otherwise a deterministic
 *      `data-phase` flip) keeps the fade mounted and re-shows it with a
 *      positive box — no page refresh required.
 *
 * Usage: node composer_fade_check.mjs [targetUrl] [edgePath] [debugPort]
 * Defaults: http://127.0.0.1:3080/ , the standard Edge path, port 9239.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:3080/'
const EDGE = process.argv[3] ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = Number(process.argv[4] ?? 9239)

const profileDir = mkdtempSync(join(tmpdir(), 'pgs-fade-'))
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
    await new Promise(resolve => setTimeout(resolve, 120))
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

/** Compact read of the live fade + phase state, serialized for the report. */
const MEASURE = `(() => {
  const frame = document.querySelector('[data-photowall-skin-frame]')
  const phaseRoot = frame?.querySelector('[data-phase]') ?? null
  const fade = document.querySelector('.pgs-composer-fade')
  const box = fade == null ? null : fade.getBoundingClientRect()
  const seat = frame?.querySelector('[data-composer-seat]') ?? null
  return {
    phase: phaseRoot?.getAttribute('data-phase') ?? null,
    fadePresent: fade != null,
    fadeVisible: fade?.hasAttribute('data-visible') ?? false,
    fadeOpacity: fade == null ? null : getComputedStyle(fade).opacity,
    fadeBox: box == null ? null : [Math.round(box.width), Math.round(box.height)],
    seatPosition: seat == null ? null : getComputedStyle(seat).position,
  }
})()`

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
  await waitFor(`document.querySelector('[data-composer-seat]') !== null && document.querySelector('[data-conversation-scroll]') !== null`, 30_000)
  await sleep(1000)

  // ── 1. CSS contract ──────────────────────────────────────────────────────
  const rawCss = await evaluate(`document.querySelector('style[data-photowall-skin]')?.textContent ?? ''`)
  const cssContract = {
    phaseTransition: /\[data-photowall-skin-frame\]\s+\[data-phase\]\s*\{[^}]*transition:\s*background-color/.test(rawCss),
    heroBackgroundColor: /\[data-photowall-skin-frame\]\s+\[data-phase='hero'\]\s*\{[^}]*background-color:/.test(rawCss),
    fadeOpacityTransition: /\.pgs-composer-fade\s*\{[^}]*transition:\s*opacity/.test(rawCss),
    fadeDefaultHidden: /\.pgs-composer-fade\s*\{[^}]*opacity:\s*0/.test(rawCss),
    fadeVisibleRule: /\.pgs-composer-fade\[data-visible\]\s*\{[^}]*opacity:\s*1/.test(rawCss),
    reducedMotionGates: /prefers-reduced-motion:\s*reduce[\s\S]*?\.pgs-composer-fade\s*\{[^}]*transition:\s*none/.test(rawCss)
      && /prefers-reduced-motion:\s*reduce[\s\S]*?\[data-photowall-skin-frame\]\s+\[data-phase\]\s*\{[^}]*transition:\s*none/.test(rawCss),
  }

  // ── 2. Reduced-motion gating ─────────────────────────────────────────────
  const motion = await evaluate(`(() => {
    const phaseEl = document.querySelector('[data-photowall-skin-frame] [data-phase]')
    const fadeEl = document.querySelector('.pgs-composer-fade')
    return {
      phase: phaseEl == null ? null : getComputedStyle(phaseEl).transitionDuration,
      fade: fadeEl == null ? null : getComputedStyle(fadeEl).transitionDuration,
    }
  })()`)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await sleep(120)
  const motionReduced = await evaluate(`(() => {
    const phaseEl = document.querySelector('[data-photowall-skin-frame] [data-phase]')
    const fadeEl = document.querySelector('.pgs-composer-fade')
    return {
      phase: phaseEl == null ? null : getComputedStyle(phaseEl).transitionDuration,
      fade: fadeEl == null ? null : getComputedStyle(fadeEl).transitionDuration,
    }
  })()`)
  await call('Emulation.setEmulatedMedia', { features: [] })
  await sleep(120)

  // ── 3. Initial active-state geometry (best effort) ───────────────────────
  const initial = await evaluate(MEASURE)

  // ── 4. hero↔active round trip ────────────────────────────────────────────
  // Prefer the real UI: click "new session" to land on hero, then click back
  // into a previous session. Falls back to a deterministic data-phase flip when
  // there is no other session to switch back to (fresh instance).
  const sessionRows = await evaluate(`document.querySelectorAll('div[role="treeitem"][aria-selected]').length`)
  const newSessionClicked = await evaluate(`(() => {
    const button = document.querySelector('button[aria-label="新建会话"], button[aria-label="New session"]')
    if (button == null) return false
    button.click()
    return true
  })()`)

  const roundTrip = { newSessionClicked, sessionRows, hero: null, back: null, note: '' }

  if (newSessionClicked) {
    await waitFor(`document.querySelector('[data-photowall-skin-frame] [data-phase]')?.getAttribute('data-phase') === 'hero'`, 20_000).catch(() => {})
    await sleep(250)
    roundTrip.hero = await evaluate(MEASURE)

    // Switch back into a previous (non-selected) session row when one exists.
    const switchedBack = await evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('div[role="treeitem"][aria-selected="false"]'))
      const row = rows.find(el => (el.textContent || '').trim() !== '')
      if (row == null) return false
      row.click()
      return true
    })()`)
    roundTrip.switchedBack = switchedBack
    if (switchedBack) {
      await waitFor(`document.querySelector('[data-photowall-skin-frame] [data-phase]')?.getAttribute('data-phase') === 'active'`, 20_000).catch(() => {})
      await sleep(250)
      roundTrip.back = await evaluate(MEASURE)
    } else {
      roundTrip.note = 'no previous session row to switch back to; using deterministic data-phase flip'
    }
  } else {
    roundTrip.note = 'new-session button unavailable; using deterministic data-phase flip'
  }

  // Deterministic fallback: drive the skin's exact contract (data-phase attr
  // mutation) when the real UI round trip could not switch back.
  if (roundTrip.back == null) {
    const flip = await evaluate(`(async () => {
      const root = document.querySelector('[data-photowall-skin-frame] [data-phase]')
      if (root == null) return null
      const wasActive = root.getAttribute('data-phase') === 'active'
      if (!wasActive) {
        root.setAttribute('data-phase', 'active')
        await new Promise(r => setTimeout(r, 300))
      }
      const active = await new Promise(resolve => {
        const f = document.querySelector('.pgs-composer-fade')
        resolve(f == null ? null : {
          visible: f.hasAttribute('data-visible'),
          box: (() => { const b = f.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)] })(),
        })
      })
      root.setAttribute('data-phase', 'hero')
      await new Promise(r => setTimeout(r, 300))
      const hero = (() => {
        const f = document.querySelector('.pgs-composer-fade')
        return f == null ? null : { visible: f.hasAttribute('data-visible'), present: true }
      })()
      root.setAttribute('data-phase', 'active')
      await new Promise(r => setTimeout(r, 300))
      const back = (() => {
        const f = document.querySelector('.pgs-composer-fade')
        return f == null ? null : {
          visible: f.hasAttribute('data-visible'),
          box: (() => { const b = f.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)] })(),
        }
      })()
      return { wasActive, active, hero, back }
    })()`)
    roundTrip.deterministic = flip
  }

  const finalState = await evaluate(MEASURE)

  // ── Pass/fail ────────────────────────────────────────────────────────────
  const fadePositive = state => Array.isArray(state?.fadeBox) && state.fadeBox[0] > 0 && state.fadeBox[1] > 0
  const roundTripOk = roundTrip.back != null
    ? fadePositive(roundTrip.back) && roundTrip.back.fadeVisible === true
    : roundTrip.deterministic != null
      && fadePositive(roundTrip.deterministic.back) && roundTrip.deterministic.back.visible === true

  const passed = (
    cssContract.phaseTransition
    && cssContract.heroBackgroundColor
    && cssContract.fadeOpacityTransition
    && cssContract.fadeDefaultHidden
    && cssContract.fadeVisibleRule
    && cssContract.reducedMotionGates
    && motionReduced.phase === '0s'
    && motionReduced.fade === '0s'
    && (initial.phase !== 'active' || (fadePositive(initial) && initial.fadeVisible === true))
    && roundTripOk
  )

  const report = {
    target: TARGET,
    cssContract,
    motion: { normal: motion, reduced: motionReduced },
    initial,
    roundTrip,
    finalState,
    passed,
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
  console.error('COMPOSER FADE CHECK FAILED:', error)
  exitCode = 1
} finally {
  edge.kill()
  setTimeout(() => { rmSync(profileDir, { recursive: true, force: true }) }, 500).unref()
}
process.exit(exitCode)
