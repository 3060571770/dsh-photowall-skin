import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const sourceHarness = 'E:/Agent-work/DeepSeekHarnessWork/.dsh-test/harness/skin-toggle-node2.mjs'
const currentRoot = 'E:/30605/Documents/ChatGPT/DSH-皮肤'
const directory = mkdtempSync(join(tmpdir(), 'pgs-current-harness-'))
const target = join(directory, 'skin-toggle-node2.mjs')
const require = createRequire('file:///E:/Agent-work/DeepSeekHarnessWork/.dsh-test/harness/node_modules/noop.js')
const reactUrl = pathToFileURL(require.resolve('react')).href
const reactDomClientUrl = pathToFileURL(require.resolve('react-dom/client')).href

try {
  let source = readFileSync(sourceHarness, 'utf8')
    .replaceAll('E:/Agent-work/DeepSeekHarnessWork/photowall-skin', currentRoot)
    .replace("import('react')", `import('${reactUrl}')`)
    .replace("import('react-dom/client')", `import('${reactDomClientUrl}')`)
  source = source.replace('  pageRoot.unmount()', `
  const tabLabels = Array.from(host.querySelectorAll('.pgs-tabs button')).map(button => button.textContent?.trim())
  const clickTab = async label => {
    Array.from(host.querySelectorAll('.pgs-tabs button')).find(button => button.textContent?.trim() === label)?.click()
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  await clickTab('Sidebar')
  const sidebarTab = host.querySelector('.pgs-range-field') !== null
  await clickTab('Palette')
  const paletteTab = host.querySelector('.pgs-quick-colors') !== null
  await clickTab('Other')
  const otherTab = host.querySelector('.pgs-action-card') !== null
  await clickTab('Gallery')
  const modeButton = label => Array.from(host.querySelectorAll('.pgs-mode-card')).find(button => button.textContent?.includes(label))
  modeButton('Static wall')?.click()
  await new Promise(resolve => setTimeout(resolve, 300))
  const staticMode = b.getSettings().gallery?.mode
  modeButton('Drift wall')?.click()
  await new Promise(resolve => setTimeout(resolve, 300))
  const rowInput = host.querySelector('input[type="range"]')
  if (rowInput) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(rowInput, '4')
    rowInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  }
  await new Promise(resolve => setTimeout(resolve, 300))
  const driftRows = b.getSettings().gallery?.rowCount
  await clickTab('Sidebar')
  host.querySelector('.pgs-card-list input[type="checkbox"]')?.click()
  await new Promise(resolve => setTimeout(resolve, 300))
  const sidebarImages = b.getSettings().sidebar?.imageIds?.dark?.length ?? 0
  await clickTab('Palette')
  const seedInput = host.querySelector('.pgs-quick-color input[type="color"]')
  if (seedInput) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(seedInput, '#123456')
    seedInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  }
  await new Promise(resolve => setTimeout(resolve, 300))
  const quickTokens = Object.keys(b.getSettings().palette?.tokens ?? {}).length
  results.pageTabs = { tabLabels, sidebarTab, paletteTab, otherTab }
  results.pageInteractions = { staticMode, driftRows, sidebarImages, quickTokens }
  pageRoot.unmount()`)
  source = source.replace(/results\.passed = \([\s\S]*?\n\)\n\nconsole\.log/, `results.passed = (
  results.overlayRegistered === 1
  && results.itemRegistered === 1
  && results.rowRendered === true
  && results.switchAfterClick?.persisted === true
  && results.switchAfterSecondClick?.persisted === false
  && results.galleryBefore?.artboard === true
  && results.galleryBefore?.images === 24
  && results.galleryAfterToggleOn?.images === 0
  && results.galleryAfterToggleOff?.images === 24
  && results.sectionRegistered === true
  && results.pageRendered === true
  && results.pageImageItems === 12
  && results.pageUploadInput === true
  && results.pageModeRadios === 0
  && results.pageSingleMode === 'drift'
  && results.pageTabs?.sidebarTab === true
  && results.pageTabs?.paletteTab === true
  && results.pageTabs?.otherTab === true
  && results.pageInteractions?.staticMode === 'static'
  && results.pageInteractions?.driftRows === 4
  && results.pageInteractions?.sidebarImages === 1
  && results.pageInteractions?.quickTokens === 17
)

console.log`)
  writeFileSync(target, source)
  await import(pathToFileURL(target).href)
} finally {
  rmSync(directory, { recursive: true, force: true })
}
