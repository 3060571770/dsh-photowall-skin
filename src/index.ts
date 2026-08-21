import { createHash, randomUUID } from 'node:crypto'
import {
  copyFileSync, createReadStream, mkdirSync, readFileSync, renameSync, rmSync,
  statSync, writeFileSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { ALL_ASSETS, ASSET_ROUTE_PREFIX, type GalleryAsset } from './assets.ts'
import {
  SAFE_MODE_FIELD, SETTINGS_NAMESPACE, type CustomImage, type SkinSettings,
} from './settings.ts'

export { SAFE_MODE_FIELD, SETTINGS_NAMESPACE, type CustomImage, type SkinSettings } from './settings.ts'
export { GALLERY_MODE_GRID, GALLERY_MODE_SINGLE, defaultSettings } from './settings.ts'

export const SkinSettingsSchema: z<SkinSettings> = z.object({
  [SAFE_MODE_FIELD]: z.boolean().default(false),
  gallery: z.object({
    // `any` intentionally accepts 0.3.x arrays and `grid` values so the
    // browser can migrate them to the new per-theme model without data loss.
    enabledIds: z.any().default({}),
    mode: z.any().default('drift'),
    singleIds: z.any().default({}),
    rowCount: z.number().default(2),
    speedSeconds: z.number().default(96),
    singleId: z.string().default(''),
  }).default({}),
  sidebar: z.object({
    imageIds: z.any().default({}),
    intervalSeconds: z.number().default(30),
    imageId: z.any().default(null),
  }).default({}),
  palette: z.object({
    tokens: z.dict(z.object({
      light: z.string(),
      dark: z.string(),
    })).default({}),
    quick: z.any().default({}),
    presets: z.array(z.any()).default([]),
  }).default({}),
})

export interface ServedAsset extends GalleryAsset {
  absolutePath: string
  bytes: number
  contentType: 'image/jpeg' | 'image/webp' | 'image/png'
  etag: string
  route: string
}

export type AssetRequestDecision =
  | { status: 200; asset: ServedAsset; head: boolean }
  | { status: 400 | 404 | 405 }

/** Uploads directory name under the package root (user-uploaded art). */
export const UPLOADS_DIR = 'uploads'
export const API_ROUTE_PREFIX = '/photowall-skin/api'

/** Persisted manifest of user-uploaded images (uploads/manifest.json). */
interface UploadManifest {
  images: (CustomImage & { etag: string })[]
}

function contentTypeOf(file: string): ServedAsset['contentType'] {
  if (file.endsWith('.webp')) return 'image/webp'
  if (file.endsWith('.png')) return 'image/png'
  return 'image/jpeg'
}

function etagOf(absolutePath: string): string {
  return `"sha256-${createHash('sha256').update(readFileSync(absolutePath)).digest('hex')}"`
}

/**
 * Runtime asset registry: the built-in allowlisted catalog (built at startup,
 * unchanged) plus user-uploaded images registered through the upload API and
 * restored from `uploads/manifest.json` on boot. Lookups prefer built-ins so
 * an uploaded file can never shadow a shipped route.
 */
export class AssetRegistry {
  private readonly builtin: ReadonlyMap<string, ServedAsset>
  private readonly custom = new Map<string, ServedAsset>()
  private readonly uploadsDir: string
  private readonly manifestPath: string

  constructor(root: string, uploadsRoot = join(root, UPLOADS_DIR)) {
    this.uploadsDir = uploadsRoot
    this.manifestPath = join(this.uploadsDir, 'manifest.json')
    this.builtin = createAssetCatalog(root)
    this.restore()
  }

  get(route: string): ServedAsset | undefined {
    return this.builtin.get(route) ?? this.custom.get(route)
  }

  /** Custom images currently registered (in upload order). */
  listCustom(): CustomImage[] {
    return [...this.custom.values()]
      .map(({ id, file, scheme, width, height }) => ({ id, file, scheme, width, height }))
  }

  /**
   * Register one uploaded image: move the temp file into place, compute the
   * etag, persist the manifest, and make the route live immediately.
   * @returns the registered asset, or `undefined` when the temp file is missing.
   */
  addUpload(scheme: 'light' | 'dark', extension: string, width: number, height: number, tempPath: string): ServedAsset | undefined {
    mkdirSync(this.uploadsDir, { recursive: true })
    const id = `user-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`
    const file = `${scheme}-${id}.${extension}`
    const absolutePath = join(this.uploadsDir, file)
    try {
      renameSync(tempPath, absolutePath)
    } catch (error) {
      // Test and embedded runtimes may place the temporary spool on a
      // different volume. Move atomically when possible, otherwise copy.
      if ((error as { code?: string }).code !== 'EXDEV') throw error
      copyFileSync(tempPath, absolutePath)
      rmSync(tempPath, { force: true })
    }
    const asset: ServedAsset = Object.freeze({
      id,
      file,
      folder: UPLOADS_DIR,
      scheme,
      width,
      height,
      tablet: true,
      mobile: true,
      absolutePath,
      bytes: statSync(absolutePath).size,
      contentType: contentTypeOf(file),
      etag: etagOf(absolutePath),
      route: `/${scheme}/${file}`,
    })
    this.custom.set(asset.route, asset)
    this.persist()
    return asset
  }

  /** Drop one uploaded image by id (file and manifest entry). */
  removeUpload(id: string): boolean {
    const entry = [...this.custom.values()].find(candidate => candidate.id === id)
    if (entry === undefined) return false
    this.custom.delete(entry.route)
    try {
      rmSync(entry.absolutePath, { force: true })
    } catch {
      // The file may already be gone; the registry entry is what matters.
    }
    this.persist()
    return true
  }

  /** Drop every uploaded image (files and manifest entries). */
  clearUploads(): void {
    for (const entry of [...this.custom.values()]) {
      try {
        rmSync(entry.absolutePath, { force: true })
      } catch {
        // The file may already be gone; the registry entry is what matters.
      }
    }
    this.custom.clear()
    this.persist()
  }

  private restore(): void {
    let manifest: UploadManifest
    try {
      manifest = JSON.parse(readFileSync(this.manifestPath, 'utf8')) as UploadManifest
    } catch {
      return
    }
    for (const entry of manifest.images) {
      const absolutePath = join(this.uploadsDir, entry.file)
      try {
        const stat = statSync(absolutePath)
        const asset: ServedAsset = Object.freeze({
          ...entry,
          tablet: true,
          mobile: true,
          absolutePath,
          bytes: stat.size,
          contentType: contentTypeOf(entry.file),
          etag: entry.etag,
          route: `/${entry.scheme}/${entry.file}`,
        })
        this.custom.set(asset.route, asset)
      } catch {
        // Manifest entry without its file: skip (upload was removed by hand).
      }
    }
  }

  private persist(): void {
    mkdirSync(this.uploadsDir, { recursive: true })
    const manifest: UploadManifest = {
      images: [...this.custom.values()].map(({ id, file, scheme, width, height, etag }) => ({
        id, file, scheme, width, height, etag,
      })),
    }
    writeFileSync(this.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

export function createAssetCatalog(root = packageRoot): ReadonlyMap<string, ServedAsset> {
  const entries = ALL_ASSETS.map((asset): readonly [string, ServedAsset] => {
    const absolutePath = join(root, asset.folder, asset.file)
    const stat = statSync(absolutePath)
    const etag = `"sha256-${createHash('sha256').update(readFileSync(absolutePath)).digest('hex')}"`
    const route = `/${asset.scheme}/${asset.file}`
    return [route, Object.freeze({
      ...asset,
      absolutePath,
      bytes: stat.size,
      contentType: contentTypeOf(asset.file),
      etag,
      route,
    })]
  })
  return new Map(entries)
}

export function decideAssetRequest(
  method: string | undefined,
  requestUrl: string | undefined,
  registry: AssetRegistry,
): AssetRequestDecision {
  if (method !== 'GET' && method !== 'HEAD') return { status: 405 }
  let pathname: string
  try {
    const rawPathname = (requestUrl ?? '/').split(/[?#]/, 1)[0]
    pathname = decodeURIComponent(rawPathname)
  } catch {
    return { status: 400 }
  }
  if (pathname.includes('\\') || pathname.includes('\0')) return { status: 400 }
  if (pathname.split('/').some((segment) => segment === '.' || segment === '..')) return { status: 404 }
  if (!pathname.startsWith(`${ASSET_ROUTE_PREFIX}/`)) return { status: 404 }
  const route = pathname.slice(ASSET_ROUTE_PREFIX.length)
  const asset = registry.get(route)
  return asset === undefined ? { status: 404 } : { status: 200, asset, head: method === 'HEAD' }
}

export function createAssetHandler(registry: AssetRegistry) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const decision = decideAssetRequest(req.method, req.url, registry)
    if (decision.status !== 200) {
      const headers = decision.status === 405 ? { Allow: 'GET, HEAD' } : undefined
      res.writeHead(decision.status, headers)
      res.end()
      return
    }

    const { asset, head } = decision
    if (req.headers['if-none-match'] === asset.etag) {
      res.writeHead(304, { ETag: asset.etag })
      res.end()
      return
    }
    res.writeHead(200, {
      'Content-Type': asset.contentType,
      'Content-Length': asset.bytes,
      'Cache-Control': 'private, max-age=0, must-revalidate',
      ETag: asset.etag,
      'X-Content-Type-Options': 'nosniff',
    })
    if (head) {
      res.end()
      return
    }
    const stream = createReadStream(asset.absolutePath)
    stream.on('error', () => res.destroy())
    stream.pipe(res)
  }
}

/** The upload API's JSON response body. */
export type ApiResponse =
  | { ok: true; image?: CustomImage; images?: CustomImage[] }
  | { ok: false; error: string }

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

function hasImageSignature(bytes: Buffer, extension: string): boolean {
  if (extension === 'jpg' || extension === 'jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (extension === 'png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  return bytes.length >= 12
    && bytes.subarray(0, 4).equals(Buffer.from('RIFF'))
    && bytes.subarray(8, 12).equals(Buffer.from('WEBP'))
}

/** Temp upload spool: created lazily, so a profile without uploads never spools. */
let spoolDir: string | undefined

function spool(): string {
  if (spoolDir === undefined) {
    spoolDir = join(packageRoot, UPLOADS_DIR, '.spool')
    mkdirSync(spoolDir, { recursive: true })
  }
  return spoolDir
}

/**
 * Handle the plugin API surface: `GET /images` lists custom images,
 * `POST /upload?scheme=dark&width=1280&height=1811&ext=png` accepts one raw
 * image body and registers it; `POST /remove?id=...` drops one.
 */
export function createApiHandler(registry: AssetRegistry) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const respond = (body: ApiResponse, status = 200): void => {
      const payload = JSON.stringify(body)
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload),
        'Cache-Control': 'no-store',
      })
      res.end(payload)
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'GET' && url.pathname.endsWith('/images')) {
      respond({ ok: true, images: registry.listCustom() })
      return
    }

    if (req.method !== 'POST') {
      respond({ ok: false, error: 'method not allowed' }, 405)
      return
    }

    if (url.pathname.endsWith('/remove')) {
      const id = url.searchParams.get('id')
      if (typeof id !== 'string' || id.length === 0 || id.length > 200) {
        respond({ ok: false, error: 'missing id' })
        return
      }
      const removed = registry.removeUpload(id)
      respond(removed ? { ok: true } : { ok: false, error: 'not found' }, removed ? 200 : 404)
      return
    }

    if (url.pathname.endsWith('/clear')) {
      registry.clearUploads()
      respond({ ok: true })
      return
    }

    if (!url.pathname.endsWith('/upload')) {
      respond({ ok: false, error: 'unknown route' }, 404)
      return
    }

    const scheme = url.searchParams.get('scheme')
    const width = Number(url.searchParams.get('width'))
    const height = Number(url.searchParams.get('height'))
    const ext = (url.searchParams.get('ext') ?? '').toLowerCase()
    if (scheme !== 'light' && scheme !== 'dark') {
      respond({ ok: false, error: 'scheme must be light or dark' })
      return
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      respond({ ok: false, error: 'width/height must be positive integers' })
      return
    }
    if (!IMAGE_EXTENSIONS.has(ext)) {
      respond({ ok: false, error: 'ext must be jpg, jpeg, png or webp' })
      return
    }

    const chunks: Buffer[] = []
    let received = 0
    let aborted = false
    req.on('data', (chunk: Buffer) => {
      if (aborted) return
      received += chunk.length
      if (received > MAX_UPLOAD_BYTES) {
        aborted = true
        chunks.length = 0
        respond({ ok: false, error: 'image exceeds 12 MB limit' }, 413)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (aborted) return
      if (chunks.length === 0) {
        respond({ ok: false, error: 'empty body' })
        return
      }
      const tempPath = join(spool(), `upload-${randomUUID()}.${ext}`)
      try {
        const bytes = Buffer.concat(chunks)
        if (!hasImageSignature(bytes, ext)) {
          respond({ ok: false, error: 'file bytes do not match the selected image format' })
          return
        }
        writeFileSync(tempPath, bytes)
        const asset = registry.addUpload(scheme, ext, width, height, tempPath)
        if (asset === undefined) {
          respond({ ok: false, error: 'upload failed' }, 500)
          return
        }
        respond({ ok: true, image: { id: asset.id, file: asset.file, scheme, width, height } })
      } catch (error) {
        respond({ ok: false, error: String(error) }, 500)
      }
    })
    req.on('error', () => {
      if (!aborted) respond({ ok: false, error: 'request aborted' }, 400)
    })
  }
}

/** Register the private settings namespace, the artwork route, and the upload API. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(SETTINGS_NAMESPACE as never, SkinSettingsSchema)
  })
  ctx.inject(['webServer'], (webCtx) => {
    const registry = new AssetRegistry(packageRoot)
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: 'prefix',
        path: ASSET_ROUTE_PREFIX,
        handler: createAssetHandler(registry),
      }),
      'photowall-skin: artwork assets',
    )
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: 'prefix',
        path: API_ROUTE_PREFIX,
        handler: createApiHandler(registry),
      }),
      'photowall-skin: upload api',
    )
  })
}
