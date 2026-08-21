const debugPort = Number(process.argv[2] ?? 9223)
const targetUrl = process.argv[3] ?? 'http://127.0.0.1:3080/'

const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json())
const target = targets.find(entry => entry.type === 'page')
if (!target?.webSocketDebuggerUrl) throw new Error('No debuggable page target is available')

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let sequence = 0
const pending = new Map()
socket.addEventListener('message', event => {
  const message = JSON.parse(String(event.data))
  if (message.id === undefined) return
  const waiter = pending.get(message.id)
  if (waiter === undefined) return
  pending.delete(message.id)
  if (message.error !== undefined) waiter.reject(new Error(message.error.message))
  else waiter.resolve(message.result)
})

function call(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails !== undefined) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  }
  return result.result.value
}

async function waitFor(expression, timeout = 15_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for: ${expression}`)
}

await call('Page.enable')
await call('Runtime.enable')
await call('Page.navigate', { url: targetUrl })
await waitFor(`document.readyState === 'complete'`)
await waitFor(`document.querySelector('[data-photowall-artboard]') !== null`)
await waitFor(`Array.from(document.querySelectorAll('[data-photowall-image]')).every(image => image.complete && image.naturalWidth > 0)`)

const viewports = [
  [1920, 1080, 11],
  [2560, 1440, 11],
  [3840, 2160, 11],
  [5120, 2880, 11],
  [820, 1180, 9],
  [390, 844, 6],
]

const results = []
for (const [width, height, expectedVisible] of viewports) {
  await call('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await new Promise(resolve => setTimeout(resolve, 180))
  const result = await evaluate(`(() => {
    const artboard = document.querySelector('[data-photowall-artboard]')
    const all = Array.from(document.querySelectorAll('[data-photowall-image]'))
    const visible = all.filter(image => {
      const box = image.getBoundingClientRect()
      return getComputedStyle(image).display !== 'none' && box.width > 0 && box.height > 0
    })
    const failures = visible.flatMap(image => {
      const style = getComputedStyle(image)
      const box = image.getBoundingClientRect()
      const reasons = []
      if (style.objectFit !== 'cover') reasons.push('object-fit')
      if (style.transform !== 'none') reasons.push('transform')
      if (!image.complete || image.naturalWidth === 0) reasons.push('load')
      if (box.width > image.naturalWidth + .5 || box.height > image.naturalHeight + .5) reasons.push('upscale')
      return reasons.map(reason => ({ id: image.closest('[data-gallery-id]')?.dataset.galleryId, reason }))
    })
    const artboardBox = artboard?.getBoundingClientRect()
    return {
      viewport: [innerWidth, innerHeight],
      scheme: artboard?.dataset.galleryScheme,
      domImages: all.length,
      visibleImages: visible.length,
      expectedVisible: ${expectedVisible},
      styleInjected: document.querySelector('style[data-photowall-skin]') !== null,
      frameMarked: document.querySelector('[data-photowall-skin-frame]') !== null,
      artboardSize: artboardBox == null ? null : [artboardBox.width, artboardBox.height],
      failures,
    }
  })()`)
  results.push(result)
}

await call('Emulation.clearDeviceMetricsOverride')

async function openSettings() {
  await evaluate(`document.querySelector('button[aria-label="打开侧边栏"]')?.click()`)
  await new Promise(resolve => setTimeout(resolve, 200))
  await evaluate(`Array.from(document.querySelectorAll('button')).find(element => element.textContent?.trim() === '设置')?.click()`)
  await waitFor(`document.querySelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]') !== null`)
}

async function inputClick(expression) {
  const point = await evaluate(`(() => {
    const element = ${expression}
    if (element == null) return null
    element.scrollIntoView({ block: 'center', inline: 'center' })
    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })()`)
  if (point == null) throw new Error(`Control not found: ${expression}`)
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
}

async function clickTheme(label) {
  await inputClick(`Array.from(document.querySelectorAll('button')).find(element => element.textContent?.trim() === ${JSON.stringify(label)})`)
}

await openSettings()
const initialInteractionState = await evaluate(`(() => {
  const labels = ['浅色', '深色', '跟随系统']
  const selectedTheme = labels.find(label => Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === label)?.getAttribute('aria-pressed') === 'true')
  return {
    selectedTheme,
    scheme: document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme,
    safeMode: document.querySelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]')?.getAttribute('aria-checked'),
  }
})()`)
const hitProbe = await evaluate(`(() => {
  const describe = element => element == null ? null : {
    tag: element.tagName,
    className: typeof element.className === 'string' ? element.className : '',
    ariaLabel: element.getAttribute('aria-label'),
    text: element.textContent?.trim().slice(0, 30) || '',
    position: getComputedStyle(element).position,
    zIndex: getComputedStyle(element).zIndex,
    pointerEvents: getComputedStyle(element).pointerEvents,
  }
  const find = label => label === '隐藏作品背景'
    ? document.querySelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]')
    : Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === label)
  return {
    artboard: describe(document.querySelector('[data-photowall-artboard]')),
    frame: describe(document.querySelector('[data-photowall-skin-frame]')),
    controls: ['浅色', '深色', '跟随系统', '隐藏作品背景'].map(label => {
      const control = find(label)
      control?.scrollIntoView({ block: 'center', inline: 'center' })
      const rect = control?.getBoundingClientRect()
      const x = rect == null ? 0 : rect.left + rect.width / 2
      const y = rect == null ? 0 : rect.top + rect.height / 2
      const hit = document.elementFromPoint(x, y)
      return {
        label,
        rect: rect == null ? null : [rect.left, rect.top, rect.width, rect.height],
        ownsHit: control?.contains(hit) ?? false,
        hit: describe(hit),
        stack: document.elementsFromPoint(x, y).slice(0, 8).map(describe),
      }
    }),
  }
})()`)

await clickTheme('浅色')
await waitFor(`document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme === 'light'`)
await waitFor(`Array.from(document.querySelectorAll('[data-photowall-image]')).every(image => image.complete && image.naturalWidth > 0)`)
const lightTheme = await evaluate(`({
  scheme: document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme,
  images: document.querySelectorAll('[data-photowall-image][data-gallery-scheme="light"]').length,
})`)

await clickTheme('深色')
await waitFor(`document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme === 'dark'`)
const darkTheme = await evaluate(`({
  scheme: document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme,
  images: document.querySelectorAll('[data-photowall-image][data-gallery-scheme="dark"]').length,
})`)

await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
await clickTheme('跟随系统')
await waitFor(`document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme === 'light'`)
const systemLight = await evaluate(`document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme`)
await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
await waitFor(`document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme === 'dark'`)
const systemDark = await evaluate(`document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme`)
await call('Emulation.setEmulatedMedia', { features: [] })

await inputClick(`document.querySelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]')`)
await waitFor(`document.querySelector('[data-photowall-artboard]') === null`)
const safeModeEnabled = await evaluate(`({
  images: document.querySelectorAll('[data-photowall-image]').length,
  checked: document.querySelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]')?.getAttribute('aria-checked'),
})`)

await call('Page.reload')
await waitFor(`document.readyState === 'complete'`)
await waitFor(`document.querySelector('style[data-photowall-skin]') !== null`)
await new Promise(resolve => setTimeout(resolve, 350))
const safeModePersisted = await evaluate(`document.querySelectorAll('[data-photowall-image]').length === 0`)

await openSettings()
await inputClick(`document.querySelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]')`)
await waitFor(`document.querySelector('[data-photowall-artboard]') !== null`)
await waitFor(`Array.from(document.querySelectorAll('[data-photowall-image]')).every(image => image.complete && image.naturalWidth > 0)`)

if (initialInteractionState.selectedTheme !== undefined && initialInteractionState.selectedTheme !== '跟随系统') {
  await clickTheme(initialInteractionState.selectedTheme)
}
await waitFor(`document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme === ${JSON.stringify(initialInteractionState.scheme)}`)

const interaction = {
  initial: initialInteractionState,
  hitProbe,
  lightTheme,
  darkTheme,
  systemLight,
  systemDark,
  safeModeEnabled,
  safeModePersisted,
  restored: await evaluate(`({
    scheme: document.querySelector('[data-photowall-artboard]')?.dataset.galleryScheme,
    images: document.querySelectorAll('[data-photowall-image]').length,
    safeMode: document.querySelector('button[aria-label="隐藏作品背景"], button[aria-label="Hide artwork background"]')?.getAttribute('aria-checked'),
  })`),
}
socket.close()

const failed = results.some(result => (
  result.domImages !== 11
  || result.visibleImages !== result.expectedVisible
  || !result.styleInjected
  || !result.frameMarked
  || result.failures.length > 0
  || result.artboardSize?.[0] > 5120
  || result.artboardSize?.[1] > 2880
)) || lightTheme.scheme !== 'light' || lightTheme.images !== 11
  || darkTheme.scheme !== 'dark' || darkTheme.images !== 11
  || hitProbe.controls.some(control => !control.ownsHit)
  || systemLight !== 'light' || systemDark !== 'dark'
  || safeModeEnabled.images !== 0 || safeModeEnabled.checked !== 'true'
  || !safeModePersisted
  || interaction.restored.images !== 11 || interaction.restored.safeMode !== 'false'

console.log(JSON.stringify({ targetUrl, results, interaction, passed: !failed }, null, 2))
if (failed) process.exitCode = 1
