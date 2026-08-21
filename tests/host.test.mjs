import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'
import {
  AssetRegistry, createAssetCatalog, decideAssetRequest, createApiHandler,
} from '../lib/index.js'

/** Package root (where the shipped artwork lives) as a native path. */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** A registry adapter over the built-in catalog (no uploads involved). */
function registryOf(catalog) {
  return { get: route => catalog.get(route) }
}

test('asset catalog ships empty (no built-in artwork)', () => {
  const catalog = createAssetCatalog()
  assert.equal(catalog.size, 0)
})

test('asset route rejects non-GET/HEAD and unknown (previously built-in) routes', () => {
  const catalog = createAssetCatalog()
  const registry = registryOf(catalog)
  assert.equal(decideAssetRequest('GET', '/photowall-skin/assets/dark/149.webp', registry).status, 404)
  assert.equal(decideAssetRequest('POST', '/photowall-skin/assets/dark/149.webp', registry).status, 405)
  assert.equal(decideAssetRequest('GET', '/photowall-skin/assets/dark/missing.webp', registry).status, 404)
})

test('encoded traversal and malformed URL input never escape the allowlist', () => {
  const catalog = createAssetCatalog()
  const registry = registryOf(catalog)
  assert.equal(decideAssetRequest('GET', '/photowall-skin/assets/dark/%2e%2e/%2e%2e/package.json', registry).status, 404)
  assert.equal(decideAssetRequest('GET', '/photowall-skin/assets/dark/%2e%2e/light/16.jpg', registry).status, 404)
  assert.equal(decideAssetRequest('GET', '/photowall-skin/assets/dark/%2e%2e%5clight%5c16.jpg', registry).status, 400)
  assert.equal(decideAssetRequest('GET', '/photowall-skin/assets/dark/%E0%A4%A', registry).status, 400)
})

test('uploaded images join the registry live and restore after a fresh registry', () => {
  const uploads = mkdtempSync(join(tmpdir(), 'pgs-test-'))
  const root = PACKAGE_ROOT
  const imageBytes = Buffer.from('fake-webp-bytes')
  const first = new AssetRegistry(root, uploads)
  const temp = join(uploads, 'temp-upload.webp')
  writeFileSync(temp, imageBytes)
  const asset = first.addUpload('dark', 'webp', 640, 480, temp)
  assert.ok(asset, 'upload registers an asset')
  assert.equal(asset.route, `/dark/${asset.file}`)
  assert.equal(first.get(asset.route)?.bytes, imageBytes.length)
  assert.equal(first.listCustom().length, 1)

  // A brand-new registry over the same uploads root restores from disk.
  const second = new AssetRegistry(root, uploads)
  assert.equal(second.get(asset.route)?.bytes, imageBytes.length)
  assert.equal(second.listCustom()[0]?.id, asset.id)

  // Removal drops the route from both the live map and the manifest.
  assert.equal(second.removeUpload(asset.id), true)
  const third = new AssetRegistry(root, uploads)
  assert.equal(third.get(asset.route), undefined)
  assert.equal(third.listCustom().length, 0)
})

test('decideAssetRequest serves uploaded routes and refuses removed ones', () => {
  const uploads = mkdtempSync(join(tmpdir(), 'pgs-test-'))
  const root = PACKAGE_ROOT
  const registry = new AssetRegistry(root, uploads)
  const temp = join(uploads, 'temp-upload.png')
  writeFileSync(temp, Buffer.from('png-bytes'))
  const asset = registry.addUpload('light', 'png', 100, 200, temp)
  const decision = decideAssetRequest('GET', `/photowall-skin/assets${asset.route}`, registry)
  assert.equal(decision.status, 200)
  assert.equal(decision.status === 200 && decision.asset.contentType, 'image/png')
  registry.removeUpload(asset.id)
  assert.equal(decideAssetRequest('GET', `/photowall-skin/assets${asset.route}`, registry).status, 404)
})

test('api handler lists uploads and rejects invalid upload parameters', async () => {
  const uploads = mkdtempSync(join(tmpdir(), 'pgs-test-'))
  const root = PACKAGE_ROOT
  const registry = new AssetRegistry(root, uploads)
  const handler = createApiHandler(registry)

  const list = await new Promise(resolve => {
    const res = { writeHead: () => {}, end: body => resolve(JSON.parse(body)) }
    handler({ method: 'GET', url: '/photowall-skin/api/images' }, res)
  })
  assert.deepEqual(list, { ok: true, images: [] })

  const invalid = await new Promise(resolve => {
    const res = { writeHead: () => {}, end: body => resolve(JSON.parse(body)) }
    handler({ method: 'POST', url: '/photowall-skin/api/upload?scheme=sepia&width=1&height=1&ext=png' }, res)
  })
  assert.equal(invalid.ok, false)
})

test('upload API rejects mismatched file signatures and accepts a real PNG header', async () => {
  const uploads = mkdtempSync(join(tmpdir(), 'pgs-test-'))
  const registry = new AssetRegistry(PACKAGE_ROOT, uploads)
  const handler = createApiHandler(registry)

  const send = async (bytes) => new Promise(resolve => {
    const req = new EventEmitter()
    req.method = 'POST'
    req.url = '/photowall-skin/api/upload?scheme=dark&width=1&height=1&ext=png'
    req.destroy = () => {}
    const res = { writeHead: () => {}, end: body => resolve(JSON.parse(body)) }
    handler(req, res)
    req.emit('data', bytes)
    req.emit('end')
  })

  const rejected = await send(Buffer.from('not-an-image'))
  assert.equal(rejected.ok, false)
  assert.match(rejected.error, /file bytes/)

  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const accepted = await send(validPng)
  assert.equal(accepted.ok, true, accepted.error)
  assert.equal(accepted.image?.scheme, 'dark')
})

test('clear API drops every uploaded image and empties the roster', async () => {
  const uploads = mkdtempSync(join(tmpdir(), 'pgs-test-'))
  const registry = new AssetRegistry(PACKAGE_ROOT, uploads)
  const handler = createApiHandler(registry)

  const upload = async () => new Promise(resolve => {
    const req = new EventEmitter()
    req.method = 'POST'
    req.url = '/photowall-skin/api/upload?scheme=dark&width=1&height=1&ext=png'
    req.destroy = () => {}
    const res = { writeHead: () => {}, end: body => resolve(JSON.parse(body)) }
    handler(req, res)
    req.emit('data', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))
    req.emit('end')
  })
  await upload()
  await upload()
  assert.equal(registry.listCustom().length, 2)

  const cleared = await new Promise(resolve => {
    const res = { writeHead: () => {}, end: body => resolve(JSON.parse(body)) }
    handler({ method: 'POST', url: '/photowall-skin/api/clear' }, res)
  })
  assert.deepEqual(cleared, { ok: true })
  assert.equal(registry.listCustom().length, 0)

  const listAfter = await new Promise(resolve => {
    const res = { writeHead: () => {}, end: body => resolve(JSON.parse(body)) }
    handler({ method: 'GET', url: '/photowall-skin/api/images' }, res)
  })
  assert.deepEqual(listAfter, { ok: true, images: [] })
})
