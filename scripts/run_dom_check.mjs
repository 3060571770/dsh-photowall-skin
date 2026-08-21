/**
 * Self-contained DOM-check driver: spawns a headless Edge with a CDP debug
 * port, waits for it to listen, then runs runtime_dom_check.mjs against it
 * in-process, and finally terminates the browser.
 *
 * Usage: node run_dom_check.mjs [edgePath] [targetUrl]
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const debugPort = 9225
const edgePath = process.argv[2] ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const targetUrl = process.argv[3] ?? 'http://127.0.0.1:3090/'
const profileDir = mkdtempSync(join(tmpdir(), 'pgs-edge-'))

const edge = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  'about:blank',
], { stdio: 'ignore' })

async function waitForDebugPort(timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Edge debug port never came up')
}

let exitCode = 0
try {
  await waitForDebugPort()
  // Re-run the check script in this process by importing it after setting argv.
  process.argv[2] = String(debugPort)
  process.argv[3] = targetUrl
  await import(new URL('./runtime_dom_check.mjs', import.meta.url))
} catch (error) {
  console.error('DOM check failed:', error)
  exitCode = 1
} finally {
  edge.kill()
  setTimeout(() => { rmSync(profileDir, { recursive: true, force: true }) }, 500).unref()
}
process.exit(exitCode)
