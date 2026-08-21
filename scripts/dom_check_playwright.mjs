/**
 * Playwright driver reproducing runtime_dom_check.mjs against the test web
 * instance, with a focus on the "Hide artwork background" toggle.
 *
 * Usage: node dom_check_playwright.mjs [targetUrl]
 */

import { chromium } from 'file:///D:/DeepSeekHarness/apps/web/node_modules/playwright/index.mjs'

const targetUrl = process.argv[2] ?? 'http://127.0.0.1:3090/'

const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--remote-debugging-port=0'] })
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: 'zh-CN' })
const report = { targetUrl }

try {
  await page.goto(targetUrl, { waitUntil: 'load' })
  await page.waitForSelector('[data-photowall-artboard]', { timeout: 20000 })
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('[data-photowall-image]')).every(image => image.complete && image.naturalWidth > 0),
    { timeout: 20000 },
  )

  report.initial = await page.evaluate(() => ({
    scheme: document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme,
    images: document.querySelectorAll('[data-photowall-image]').length,
    styleInjected: document.querySelector('style[data-photowall-skin]') !== null,
    frameMarked: document.querySelector('[data-photowall-skin-frame]') !== null,
  }))

  // Open settings via sidebar trigger then the 设置 nav button.
  await page.click('button[aria-label="打开侧边栏"]')
  await page.waitForTimeout(300)
  await page.click('text=设置')
  await page.waitForSelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]', { timeout: 10000 })

  const switchLocator = page.locator('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]').first()
  report.switchBefore = {
    checked: await switchLocator.getAttribute('aria-checked'),
    disabled: await switchLocator.isDisabled(),
  }

  // Toggle ON.
  await switchLocator.click()
  await page.waitForFunction(
    () => document.querySelector('[data-photowall-artboard]') === null,
    { timeout: 10000 },
  ).catch(() => {})
  report.afterToggleOn = await page.evaluate(() => ({
    artboardGone: document.querySelector('[data-photowall-artboard]') === null,
    images: document.querySelectorAll('[data-photowall-image]').length,
    checked: document.querySelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]')?.getAttribute('aria-checked'),
  }))

  // Reload: persistence check.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('style[data-photowall-skin]', { timeout: 15000 })
  await page.waitForTimeout(400)
  report.afterReload = await page.evaluate(() => ({
    artboardGone: document.querySelector('[data-photowall-artboard]') === null,
    images: document.querySelectorAll('[data-photowall-image]').length,
  }))

  // Toggle OFF again.
  await page.click('button[aria-label="打开侧边栏"]')
  await page.waitForTimeout(300)
  await page.click('text=设置')
  await page.waitForSelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]', { timeout: 10000 })
  const switch2 = page.locator('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]').first()
  await switch2.click()
  await page.waitForFunction(
    () => document.querySelector('[data-photowall-artboard]') !== null,
    { timeout: 10000 },
  ).catch(() => {})
  report.afterToggleOff = await page.evaluate(() => ({
    artboardBack: document.querySelector('[data-photowall-artboard]') !== null,
    images: document.querySelectorAll('[data-photowall-image]').length,
    checked: document.querySelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]')?.getAttribute('aria-checked'),
  }))

  report.passed = (
    report.initial.scheme !== undefined
    && report.initial.images === 11
    && report.initial.styleInjected
    && report.initial.frameMarked
    && report.switchBefore.checked === 'false'
    && !report.switchBefore.disabled
    && report.afterToggleOn.artboardGone
    && report.afterToggleOn.images === 0
    && report.afterToggleOn.checked === 'true'
    && report.afterReload.artboardGone
    && report.afterReload.images === 0
    && report.afterToggleOff.artboardBack
    && report.afterToggleOff.images === 11
    && report.afterToggleOff.checked === 'false'
  )
} catch (error) {
  report.error = String(error)
  report.passed = false
} finally {
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
}
process.exit(report.passed ? 0 : 1)
