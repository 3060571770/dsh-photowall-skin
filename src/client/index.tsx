import React, {
  useEffect, useLayoutEffect, useState, useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { GALLERY_ASSETS, assetUrl, type GalleryAsset, type GalleryScheme } from '../assets.ts'
import {
  GALLERY_MODE_DRIFT, GALLERY_MODE_SINGLE, GALLERY_MODE_STATIC, SETTINGS_NAMESPACE,
  defaultSettings, type CustomImage, type PaletteColor, type SkinSettings,
} from '../settings.ts'
import { TOKENS } from './tokens.ts'
import { GALLERY_STYLE } from './styles.ts'
import { SettingsPage } from './settings-page.tsx'
import { normalizeGallery, normalizePalette, normalizeSidebar } from './settings-model.ts'

export const LOCALE_NAMESPACE = 'photowall-skin.settings'

const zh = {
  'safe.title': '隐藏作品背景',
  'safe.description': '隐藏作品墙，仅保留浅色或深色配色。',
  'section.label': '皮肤',
  'section.description': '自定义画廊图片、侧栏背景与界面配色。',
  'token.bg-base': '背景底色',
  'token.bg-layer-1': '面板一级',
  'token.bg-layer-2': '面板二级',
  'token.bg-layer-3': '面板三级',
  'token.bg-overlay': '浮层底色',
  'token.border-l1': '细边框',
  'token.border-l2': '中边框',
  'token.border-l3': '粗边框',
  'token.brand-primary': '品牌主色',
  'token.brand-text': '品牌文字',
  'token.button-primary-hover': '主按钮悬停',
  'token.label-primary': '主文字',
  'token.label-secondary': '次要文字',
  'token.label-tertiary': '弱化文字',
  'token.label-primary-foreground': '主文字反色',
  'token.sidebar-fill': '侧栏底色',
  'token.bubble': '消息气泡',
  'gallery.title': '画廊图片',
  'gallery.mode-single': '单图',
  'gallery.upload': '上传图片',
  'gallery.remove': '删除',
  'gallery.move-up': '上移',
  'gallery.move-down': '下移',
  'gallery.single-pick': '选择单图',
  'sidebar.title': '侧栏背景',
  'palette.title': '界面配色',
  'palette.light': '浅色',
  'palette.dark': '深色',
  'palette.reset': '恢复默认',
  'tab.gallery': '画廊',
  'tab.sidebar': '侧栏',
  'tab.palette': '配色',
  'tab.other': '其他',
  'theme.pick': '选择主题',
  'gallery.preview': '背景预览',
  'gallery.mode-drift': '漂移墙',
  'gallery.mode-drift-note': '多行反向缓慢漂移',
  'gallery.mode-static': '静态墙',
  'gallery.mode-static-note': '固定拼图，无动态效果',
  'gallery.mode-single-note': '每个主题单独选择一张作品',
  'gallery.rows': '行数',
  'gallery.speed': '漂移速度',
  'gallery.library': '作品库',
  'gallery.library-note': '勾选启用，拖动或使用箭头排序',
  'gallery.enabled': '启用',
  'gallery.upload-note': '拖入 JPG、PNG 或 WebP，最大 12 MB；可一次选择多张，上传后自动加入当前主题。',
  'gallery.choose-file': '选择图片',
  'gallery.remove-confirm': '删除这张自定义图片？它会同时从画廊和侧栏选择中移除。',
  'gallery.remove-failed': '删除图片失败',
  'gallery.clear': '清空作品库',
  'gallery.clear-confirm': '删除全部上传的图片？画廊和侧栏里的选择也会一并清空。',
  'sidebar.note': '选择一张时静态显示；选择多张时按顺序淡入淡出轮播。',
  'sidebar.interval': '轮播间隔',
  'sidebar.use': '用于侧栏',
  'palette.quick-title': '快速配色',
  'palette.quick-note': '为深浅主题各选一个主色，自动生成整套玻璃界面。',
  'palette.quick-hint': '调整主色或透明度会重新生成整套配色，并覆盖下方的手工改动。',
  'palette.seed': '主题主色',
  'palette.opacity': '整体透明度',
  'palette.builtin': '内置预设',
  'palette.common': '常用颜色',
  'palette.preset-name': '为当前配色命名',
  'palette.save': '保存预设',
  'palette.delete-preset': '删除预设',
  'palette.delete-confirm': '删除这个自定义预设？',
  'palette.replace-confirm': '已有同名预设，是否覆盖？',
  'palette.advanced': '高级设置',
  'palette.expand': '展开逐项编辑',
  'palette.collapse': '收起逐项编辑',
  'palette.component': '部件',
  'palette.group-background': '背景',
  'palette.group-border': '边框',
  'palette.group-brand': '品牌',
  'palette.group-label': '文字',
  'other.reset-gallery': '重置画廊',
  'other.reset-gallery-note': '清空画廊图片并恢复漂移墙与两行布局。',
  'other.reset-sidebar': '重置侧栏',
  'other.reset-sidebar-note': '清空侧栏图片并恢复默认轮播间隔。',
  'other.reset-all': '恢复全部默认',
  'other.reset-all-note': '删除当前皮肤的设置、轮播和配色预设。',
  'other.reset-all-confirm': '恢复皮肤的全部默认设置？自定义预设也会被删除。',
  'other.compatibility': 'better-sidebar 保持原有推挤布局；皮肤只同步它的磨砂外观和配色。',
}

const en = {
  'safe.title': 'Hide artwork background',
  'safe.description': 'Hide the gallery wall while keeping the light or dark palette.',
  'section.label': 'Skin',
  'section.description': 'Customize gallery art, sidebar background and UI colors.',
  'token.bg-base': 'Background base',
  'token.bg-layer-1': 'Panel layer 1',
  'token.bg-layer-2': 'Panel layer 2',
  'token.bg-layer-3': 'Panel layer 3',
  'token.bg-overlay': 'Overlay base',
  'token.border-l1': 'Border thin',
  'token.border-l2': 'Border medium',
  'token.border-l3': 'Border thick',
  'token.brand-primary': 'Brand primary',
  'token.brand-text': 'Brand text',
  'token.button-primary-hover': 'Primary button hover',
  'token.label-primary': 'Label primary',
  'token.label-secondary': 'Label secondary',
  'token.label-tertiary': 'Label tertiary',
  'token.label-primary-foreground': 'Label on primary',
  'token.sidebar-fill': 'Sidebar fill',
  'token.bubble': 'Message bubble',
  'gallery.title': 'Gallery images',
  'gallery.mode-single': 'Single image',
  'gallery.upload': 'Upload image',
  'gallery.remove': 'Remove',
  'gallery.move-up': 'Move up',
  'gallery.move-down': 'Move down',
  'gallery.single-pick': 'Pick single image',
  'sidebar.title': 'Sidebar background',
  'palette.title': 'UI colors',
  'palette.light': 'Light',
  'palette.dark': 'Dark',
  'palette.reset': 'Reset',
  'tab.gallery': 'Gallery',
  'tab.sidebar': 'Sidebar',
  'tab.palette': 'Palette',
  'tab.other': 'Other',
  'theme.pick': 'Choose theme',
  'gallery.preview': 'Background preview',
  'gallery.mode-drift': 'Drift wall',
  'gallery.mode-drift-note': 'Slow counter-moving rows',
  'gallery.mode-static': 'Static wall',
  'gallery.mode-static-note': 'A fixed image mosaic',
  'gallery.mode-single-note': 'One artwork saved for each theme',
  'gallery.rows': 'Rows',
  'gallery.speed': 'Drift speed',
  'gallery.library': 'Artwork library',
  'gallery.library-note': 'Enable items, then drag or use arrows to order them.',
  'gallery.enabled': 'Enabled',
  'gallery.upload-note': 'Drop JPG, PNG or WebP up to 12 MB. Select several at once; each joins this theme automatically.',
  'gallery.choose-file': 'Choose image',
  'gallery.remove-confirm': 'Remove this custom image? It will also be removed from gallery and sidebar picks.',
  'gallery.remove-failed': 'Could not remove image',
  'gallery.clear': 'Clear library',
  'gallery.clear-confirm': 'Delete all uploaded images? Their gallery and sidebar selections will be cleared too.',
  'sidebar.note': 'One image stays still; multiple images crossfade in order.',
  'sidebar.interval': 'Rotation interval',
  'sidebar.use': 'Use in sidebar',
  'palette.quick-title': 'Quick palette',
  'palette.quick-note': 'Pick one seed color for each theme to generate the glass interface.',
  'palette.quick-hint': 'Changing the seed or opacity regenerates the whole palette and overwrites manual tweaks below.',
  'palette.seed': 'Theme seed',
  'palette.opacity': 'Overall opacity',
  'palette.builtin': 'Built-in presets',
  'palette.common': 'Common colors',
  'palette.preset-name': 'Name this palette',
  'palette.save': 'Save preset',
  'palette.delete-preset': 'Delete preset',
  'palette.delete-confirm': 'Delete this custom preset?',
  'palette.replace-confirm': 'A preset with this name already exists. Replace it?',
  'palette.advanced': 'Advanced settings',
  'palette.expand': 'Edit individual tokens',
  'palette.collapse': 'Collapse token editor',
  'palette.component': 'Component',
  'palette.group-background': 'Background',
  'palette.group-border': 'Borders',
  'palette.group-brand': 'Brand',
  'palette.group-label': 'Text',
  'other.reset-gallery': 'Reset gallery',
  'other.reset-gallery-note': 'Clear gallery images and restore the drift wall and two rows.',
  'other.reset-sidebar': 'Reset sidebar',
  'other.reset-sidebar-note': 'Clear sidebar images and restore the rotation interval.',
  'other.reset-all': 'Reset everything',
  'other.reset-all-note': 'Remove this skin’s settings, rotations and palette presets.',
  'other.reset-all-confirm': 'Reset every skin setting? Custom presets will be deleted too.',
  'other.compatibility': 'better-sidebar keeps its original push layout; the skin only matches its glass treatment and palette.',
}

export { TOKENS } from './tokens.ts'

interface SkinSnapshot {
  scheme: GalleryScheme
  safeMode: boolean
  writable: boolean
  ready: boolean
  galleryMode: 'drift' | 'static' | 'single'
  galleryIds: string[]
  singleId: string
  rowCount: number
  driftSpeedSeconds: number
  sidebarImageIds: string[]
  sidebarIntervalSeconds: number
  paletteTokens: Record<string, PaletteColor>
  /** Bumped whenever the user-uploaded roster refreshes (re-render trigger). */
  customRevision: number
}

export class SkinRuntime {
  private listeners = new Set<() => void>()
  private snapshot: SkinSnapshot
  private customImages: CustomImage[] = []
  private customRevision = 0
  private disposeTokens: (() => void) | undefined
  private raw: SkinSettings
  private lastSent: SkinSettings
  private persistTimers = new Map<string, number>()

  constructor(
    private readonly scope: SettingsScope<SkinSettings>,
    private readonly theme: { overrideTokens: (source: string, tokens: Record<string, PaletteColor>) => () => void },
    scheme: GalleryScheme,
  ) {
    const scopeSnapshot = scope.getSnapshot()
    this.raw = scopeSnapshot.value ?? defaultSettings()
    this.lastSent = { ...this.raw }
    this.snapshot = this.readSettings(this.raw, scheme, scopeSnapshot.status === 'loading')
    this.applyTokens()
  }

  getSnapshot = (): SkinSnapshot => this.snapshot

  /** The optimistic raw settings — the single source for the settings form. */
  getRaw = (): SkinSettings => this.raw

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  sync(scheme = this.snapshot.scheme): void {
    const scopeSnapshot = this.scope.getSnapshot()
    const persisted = scopeSnapshot.value ?? defaultSettings()
    const merged: SkinSettings = { ...this.raw }
    for (const field of ['safeMode', 'gallery', 'sidebar', 'palette'] as const) {
      if (this.persistTimers.has(field)) continue // a pending local edit wins
      merged[field] = persisted[field]
    }
    this.raw = merged
    this.lastSent = { ...merged }
    this.snapshot = this.readSettings(merged, scheme, scopeSnapshot.status === 'loading')
    this.applyTokens()
    for (const listener of this.listeners) listener()
  }

  /** Apply an optimistic settings value immediately and queue its persistence. */
  update(next: SkinSettings): void {
    const nextSnapshot = this.readSettings(next, this.snapshot.scheme, false)
    const tokensChanged = nextSnapshot.paletteTokens !== this.snapshot.paletteTokens
    this.raw = next
    this.snapshot = nextSnapshot
    if (tokensChanged) this.applyTokens()
    for (const listener of this.listeners) listener()
    this.persistChanges(next)
  }

  setSafeMode(value: boolean): void {
    this.update({ ...this.raw, safeMode: value })
  }

  /** Refresh the user-uploaded image roster from the host API. */
  async refreshCustomImages(): Promise<CustomImage[]> {
    try {
      const response = await fetch('/photowall-skin/api/images')
      const body = await response.json() as { ok: boolean; images?: CustomImage[] }
      this.customImages = body.ok && Array.isArray(body.images) ? body.images : []
    } catch {
      this.customImages = []
    }
    this.customRevision += 1
    this.snapshot = { ...this.snapshot, customRevision: this.customRevision }
    for (const listener of this.listeners) listener()
    return this.customImages
  }

  getCustomImages(): CustomImage[] {
    return this.customImages
  }

  disposeTokensEffect(): void {
    for (const timer of this.persistTimers.values()) window.clearTimeout(timer)
    this.persistTimers.clear()
    this.disposeTokens?.()
  }

  private appliedTokensJson = ''

  private applyTokens(): void {
    const merged: Record<string, PaletteColor> = { ...TOKENS }
    for (const [name, color] of Object.entries(this.snapshot.paletteTokens)) {
      merged[name] = { light: color.light, dark: color.dark }
    }
    const json = JSON.stringify(merged)
    // Idempotence guard: overrideTokens emits `theme/change`, which re-enters
    // sync() → applyTokens(). Re-applying identical tokens would otherwise loop.
    if (json === this.appliedTokensJson) return
    this.appliedTokensJson = json
    this.disposeTokens?.()
    this.disposeTokens = this.theme.overrideTokens('dsh-photowall-skin', merged)
  }

  private persistChanges(next: SkinSettings): void {
    const fields = ['safeMode', 'gallery', 'sidebar', 'palette'] as const
    for (const field of fields) {
      if (JSON.stringify(this.lastSent[field]) === JSON.stringify(next[field])) continue
      this.lastSent = { ...this.lastSent, [field]: next[field] }
      const previous = this.persistTimers.get(field)
      if (previous !== undefined) window.clearTimeout(previous)
      this.persistTimers.set(field, window.setTimeout(() => {
        this.persistTimers.delete(field)
        void this.scope.set(field, next[field])
      }, 200))
    }
  }

  private readSettings(settings: SkinSettings, scheme: GalleryScheme, loading: boolean): SkinSnapshot {
    const gallery = normalizeGallery(settings.gallery, this.customImages)
    const sidebar = normalizeSidebar(settings.sidebar, this.customImages)
    const palette = normalizePalette(settings.palette)
    return {
      scheme,
      // While the persisted settings are still loading, hold the artwork back
      // (treat safe mode as on) so the gallery and sidebar art never flash on
      // and then off when the stored value is `safeMode: true`.
      safeMode: loading ? true : (settings.safeMode ?? false),
      writable: this.scope.getSnapshot().writable,
      ready: !loading,
      galleryMode: gallery.mode === GALLERY_MODE_SINGLE
        ? GALLERY_MODE_SINGLE
        : gallery.mode === GALLERY_MODE_STATIC ? GALLERY_MODE_STATIC : GALLERY_MODE_DRIFT,
      galleryIds: gallery.enabledIds[scheme],
      singleId: gallery.singleIds[scheme],
      rowCount: gallery.rowCount,
      driftSpeedSeconds: gallery.speedSeconds,
      sidebarImageIds: sidebar.imageIds[scheme],
      sidebarIntervalSeconds: sidebar.intervalSeconds,
      paletteTokens: palette.tokens,
      customRevision: this.customRevision,
    }
  }
}

function GalleryTile({ asset, priority, copy }: {
  asset: GalleryAsset
  priority: boolean
  copy: 'original' | 'loop'
}) {
  return (
    <figure
      className="pgs-tile"
      data-gallery-id={asset.id}
      data-gallery-copy={copy}
      data-tablet={String(asset.tablet)}
      data-mobile={String(asset.mobile)}
    >
      <img
        className="pgs-image"
        data-photowall-image=""
        data-gallery-scheme={asset.scheme}
        alt=""
        aria-hidden="true"
        draggable={false}
        width={asset.width}
        height={asset.height}
        loading="eager"
        decoding="async"
        src={assetUrl(asset)}
      />
    </figure>
  )
}

function GallerySequence({ assets, copy }: {
  assets: readonly GalleryAsset[]
  copy: 'original' | 'loop'
}) {
  return (
    <div className="pgs-sequence" data-gallery-copy={copy}>
      {assets.map((asset, index) => (
        <GalleryTile
          key={`${copy}-${asset.id}`}
          asset={asset}
          priority={copy === 'original' && index < 2}
          copy={copy}
        />
      ))}
    </div>
  )
}

function assetsForRow(assets: readonly GalleryAsset[], rowIndex: number, rowCount: number): GalleryAsset[] {
  const tiles = Math.max(4, Math.ceil(assets.length / rowCount))
  const stride = Math.max(1, Math.floor(assets.length / rowCount))
  return Array.from({ length: tiles }, (_, index) => assets[(rowIndex * stride + index) % assets.length]!)
}

function StaticWall({ assets, rowCount }: { assets: readonly GalleryAsset[]; rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, rowIndex) => {
        const rowAssets = assetsForRow(assets, rowIndex, rowCount)
        return (
          <div key={rowIndex} className="pgs-row pgs-static-row" data-pgs-row={rowIndex}>
            {rowAssets.map((asset, index) => (
              <GalleryTile key={`static-${rowIndex}-${index}`} asset={asset} priority={index < 2} copy="original" />
            ))}
          </div>
        )
      })}
    </>
  )
}

function DriftWall({ assets, rowCount }: { assets: readonly GalleryAsset[]; rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, rowIndex) => {
        const rowAssets = assetsForRow(assets, rowIndex, rowCount)
        return (
          <div key={rowIndex} className="pgs-row" data-pgs-row={rowIndex}>
            <div className="pgs-track">
              <GallerySequence assets={rowAssets} copy="original" />
              <GallerySequence assets={rowAssets} copy="loop" />
            </div>
          </div>
        )
      })}
    </>
  )
}

function preloadScheme(scheme: GalleryScheme): () => void {
  const images: HTMLImageElement[] = []
  const load = (): void => {
    for (const asset of GALLERY_ASSETS[scheme]) {
      const image = new Image()
      image.decoding = 'async'
      image.src = assetUrl(asset)
      images.push(image)
    }
  }
  const browser = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  if (browser.requestIdleCallback !== undefined) {
    const id = browser.requestIdleCallback(load, { timeout: 3000 })
    return () => { browser.cancelIdleCallback?.(id) }
  }
  const id = window.setTimeout(load, 400)
  return () => { window.clearTimeout(id) }
}

/** Resolve the ordered gallery wall for the current scheme from user uploads
 * only (no built-in artwork ships). IDs that no longer resolve are dropped. */
function resolveGalleryAssets(snapshot: SkinSnapshot, customImages: CustomImage[]): GalleryAsset[] {
  const customs = customImages.filter(image => image.scheme === snapshot.scheme)
  const resolved: GalleryAsset[] = []
  for (const id of snapshot.galleryIds) {
    const asset = customs.find(image => image.id === id)
    if (asset !== undefined) resolved.push(asset as GalleryAsset)
  }
  return resolved
}

function resolveAssetById(snapshot: SkinSnapshot, customImages: CustomImage[], id: string): GalleryAsset | undefined {
  if (id === '') return undefined
  return customImages.find(image => image.id === id && image.scheme === snapshot.scheme) as GalleryAsset | undefined
}

function GalleryOverlay({ runtime }: { runtime: SkinRuntime }) {
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot)
  const [marker, setMarker] = useState<HTMLSpanElement | null>(null)
  const [frame, setFrame] = useState<HTMLElement | null>(null)
  const [sidebarIndex, setSidebarIndex] = useState(0)
  const [sidebarUrls, setSidebarUrls] = useState({ current: '', previous: '', transitioning: false })
  const [composerFade, setComposerFade] = useState<{
    left: number
    width: number
    height: number
    visible: boolean
  } | null>(null)
  const customImages = runtime.getCustomImages()

  // The gallery and sidebar are built entirely from user uploads, so load the
  // roster here at startup — otherwise the artwork stays blank until the
  // settings page happens to open and trigger the fetch.
  useEffect(() => {
    void runtime.refreshCustomImages()
  }, [runtime])

  useLayoutEffect(() => {
    const overlay = marker?.closest<HTMLElement>('[data-shell-overlay]')
    const nextFrame = overlay?.parentElement ?? null
    if (nextFrame === null) return
    nextFrame.dataset.photowallSkinFrame = ''
    setFrame(nextFrame)
    return () => {
      delete nextFrame.dataset.photowallSkinFrame
      setFrame(null)
    }
  }, [marker])

  // Frame-level composer fade: the composer seat sits inside the scroll
  // container, so any gradient on the seat itself is clipped at the scrollport
  // (leaving the scrollbar gutter uncovered). This overlay is portaled into
  // the frame (outside the scroll container) and tracks the seat's live box so
  // the fade extends across the full column, under the scrollbar.
  //
  // The seat/scroll nodes are resident (they survive session switches), but
  // the hero↔active transition only flips the seat's `position` (static↔sticky),
  // which ResizeObserver never reports. So visibility is driven by the session
  // root's `data-phase` (only `active` shows the fade) via a MutationObserver,
  // and the seat/scroll nodes are re-queried on every measurement so a rebuilt
  // subtree can never strand the effect on a detached reference.
  useLayoutEffect(() => {
    if (frame === null) return

    let rafId: number | undefined
    let observedSeat: HTMLElement | null = null
    let observedScroll: HTMLElement | null = null

    const update = (): void => {
      const seat = frame.querySelector<HTMLElement>('[data-composer-seat]')
      const scroll = frame.querySelector<HTMLElement>('[data-conversation-scroll]')

      // Re-aim the ResizeObserver when the host rebuilds the nodes so we keep
      // tracking the live boxes rather than a detached pair.
      if (seat !== observedSeat || scroll !== observedScroll) {
        resizeObserver.disconnect()
        if (seat !== null) resizeObserver.observe(seat)
        if (scroll !== null) resizeObserver.observe(scroll)
        observedSeat = seat
        observedScroll = scroll
      }

      const phaseRoot = seat?.closest<HTMLElement>('[data-phase]')
        ?? scroll?.closest<HTMLElement>('[data-phase]')
        ?? frame.querySelector<HTMLElement>('[data-phase]')
      // Primary visibility switch: only the `active` phase docks the composer.
      // `position: sticky` is kept as a geometry fallback when the phase root
      // cannot be resolved (older host skeleton).
      const active = phaseRoot === undefined
        ? seat !== null && getComputedStyle(seat).position === 'sticky'
        : phaseRoot.dataset.phase === 'active'

      if (!active) {
        // Hide but keep the last good geometry so the node can fade out in place.
        setComposerFade(current => (current === null ? null : { ...current, visible: false }))
        return
      }
      if (seat === null || scroll === null || !seat.isConnected || !scroll.isConnected) return

      const frameRect = frame.getBoundingClientRect()
      const scrollRect = scroll.getBoundingClientRect()
      const seatRect = seat.getBoundingClientRect()
      // Never write a collapsed box: keep the previous good value instead.
      if (scrollRect.width <= 0 || seatRect.height <= 0) return

      const next = {
        left: scrollRect.left - frameRect.left,
        width: scrollRect.width,
        height: seatRect.height,
        visible: true,
      }
      setComposerFade(current => (
        current !== null
          && current.left === next.left
          && current.width === next.width
          && current.height === next.height
          && current.visible === next.visible
          ? current
          : next
      ))
    }

    const schedule = (): void => {
      if (rafId !== undefined) return
      rafId = requestAnimationFrame(() => {
        rafId = undefined
        update()
      })
    }

    const resizeObserver = new ResizeObserver(update)
    update()

    const mutationObserver = new MutationObserver(schedule)
    mutationObserver.observe(frame, {
      attributes: true,
      attributeFilter: ['data-phase'],
      childList: true,
      subtree: true,
    })

    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      mutationObserver.disconnect()
      resizeObserver.disconnect()
    }
  }, [frame])

  useLayoutEffect(() => {
    if (frame === null) return
    frame.dataset.photowallScheme = snapshot.scheme
    return () => {
      delete frame.dataset.photowallScheme
    }
  }, [frame, snapshot.scheme])

  useEffect(() => {
    if (snapshot.safeMode) return
    return preloadScheme(snapshot.scheme === 'dark' ? 'light' : 'dark')
  }, [snapshot.safeMode, snapshot.scheme])

  // useLayoutEffect (not useEffect): the safe attribute must be written before
  // the first paint so the sidebar art never flashes when safe mode is on.
  useLayoutEffect(() => {
    if (frame === null) return
    frame.toggleAttribute('data-photowall-safe', snapshot.safeMode)
  }, [frame, snapshot.safeMode])

  const sidebarAssets = snapshot.sidebarImageIds
    .map(id => resolveAssetById(snapshot, customImages, id))
    .filter((asset): asset is GalleryAsset => asset !== undefined)
  const sidebarAsset = sidebarAssets.length > 0 ? sidebarAssets[sidebarIndex % sidebarAssets.length]! : undefined

  useEffect(() => {
    setSidebarIndex(0)
  }, [snapshot.scheme, snapshot.sidebarImageIds, customImages])

  useEffect(() => {
    if (sidebarAssets.length < 2) return
    let timer: number | undefined
    const start = (): void => {
      if (document.visibilityState === 'hidden') return
      timer = window.setInterval(() => {
        setSidebarIndex(index => (index + 1) % sidebarAssets.length)
      }, snapshot.sidebarIntervalSeconds * 1000)
    }
    const visibility = (): void => {
      if (timer !== undefined) window.clearInterval(timer)
      timer = undefined
      start()
    }
    start()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      if (timer !== undefined) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [sidebarAssets.length, snapshot.sidebarIntervalSeconds, snapshot.scheme, snapshot.sidebarImageIds, customImages])

  // Sidebar art uses a two-layer CSS background so every carousel change can
  // crossfade without touching the host sidebar's own markup.
  useEffect(() => {
    if (frame === null) return
    const url = sidebarAsset === undefined ? '' : assetUrl(sidebarAsset)
    setSidebarUrls(previous => ({
      current: url,
      previous: url === '' ? '' : previous.current || url,
      transitioning: false,
    }))
  }, [frame, sidebarAsset])

  useEffect(() => {
    if (frame === null) return
    if (sidebarUrls.current === '') {
      frame.style.removeProperty('--pgs-sidebar-image')
      frame.style.removeProperty('--pgs-sidebar-image-previous')
      frame.toggleAttribute('data-photowall-sidebar-transition', false)
      return
    }
    frame.style.setProperty('--pgs-sidebar-image', `url("${sidebarUrls.current}")`)
    frame.style.setProperty('--pgs-sidebar-image-previous', `url("${sidebarUrls.previous}")`)
    frame.toggleAttribute('data-photowall-sidebar-transition', sidebarUrls.transitioning)
    const animation = !sidebarUrls.transitioning && sidebarUrls.previous !== sidebarUrls.current
      ? window.requestAnimationFrame(() => setSidebarUrls(value => (
        value.current === sidebarUrls.current && value.previous !== value.current
          ? { ...value, transitioning: true }
          : value
      )))
      : undefined
    const timer = sidebarUrls.transitioning
      ? window.setTimeout(() => setSidebarUrls(value => ({ current: value.current, previous: value.current, transitioning: false })), 850)
      : undefined
    return () => {
      if (animation !== undefined) window.cancelAnimationFrame(animation)
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [frame, sidebarUrls])

  const assets = resolveGalleryAssets(snapshot, customImages)
  const singleAsset = snapshot.galleryMode === GALLERY_MODE_SINGLE
    ? resolveAssetById(snapshot, customImages, snapshot.singleId)
    : undefined

  let artboard: React.ReactNode = null
  if (!snapshot.safeMode) {
    if (snapshot.galleryMode === GALLERY_MODE_SINGLE && singleAsset !== undefined) {
      artboard = (
        <div
          className="pgs-artboard pgs-artboard-single"
          data-photowall-artboard=""
          data-gallery-scheme={snapshot.scheme}
          aria-hidden="true"
          style={{
            '--pgs-canvas': snapshot.scheme === 'dark' ? '#3E2722' : '#F9EAE5',
            '--pgs-edge': snapshot.scheme === 'dark' ? '#F7D9C3' : '#35363A',
            '--pgs-fallback': snapshot.scheme === 'dark' ? '#5F4F49' : '#D6D0CE',
          } as React.CSSProperties}
        >
          <img
            className="pgs-image pgs-image-single"
            data-photowall-image=""
            data-gallery-scheme={singleAsset.scheme}
            alt=""
            aria-hidden="true"
            draggable={false}
            width={singleAsset.width}
            height={singleAsset.height}
            src={assetUrl(singleAsset)}
          />
          <div className="pgs-scrim" />
        </div>
      )
    } else if (assets.length > 0) {
      artboard = (
        <div
          className="pgs-artboard"
          data-photowall-artboard=""
          data-gallery-scheme={snapshot.scheme}
          aria-hidden="true"
          style={{
            '--pgs-canvas': snapshot.scheme === 'dark' ? '#3E2722' : '#F9EAE5',
            '--pgs-edge': snapshot.scheme === 'dark' ? '#F7D9C3' : '#35363A',
            '--pgs-fallback': snapshot.scheme === 'dark' ? '#5F4F49' : '#D6D0CE',
            '--pgs-drift-duration': `${snapshot.driftSpeedSeconds}s`,
            '--pgs-scrim': snapshot.scheme === 'dark'
              ? 'linear-gradient(90deg, rgba(35,22,18,.26), rgba(35,22,18,.08) 48%, rgba(35,22,18,.24))'
              : 'linear-gradient(90deg, rgba(249,234,229,.30), rgba(249,234,229,.10) 48%, rgba(249,234,229,.28))',
          } as React.CSSProperties}
        >
          {snapshot.galleryMode === GALLERY_MODE_STATIC ? (
            <StaticWall assets={assets} rowCount={snapshot.rowCount} />
          ) : <DriftWall assets={assets} rowCount={snapshot.rowCount} />}
          <div className="pgs-scrim" />
        </div>
      )
    }
  }

  return (
    <>
      <span ref={setMarker} className="pgs-marker" aria-hidden="true" />
      {frame !== null && artboard !== null ? createPortal(artboard, frame) : null}
      {frame !== null && composerFade !== null ? createPortal(
        <div
          className="pgs-composer-fade"
          data-visible={composerFade.visible ? '' : undefined}
          aria-hidden="true"
          style={{ left: composerFade.left, width: composerFade.width, height: composerFade.height }}
        />,
        frame,
      ) : null}
    </>
  )
}

function SettingsRow({ runtime, t }: { runtime: SkinRuntime; t: (key: keyof typeof zh) => string }) {
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot)
  return (
    <div className="pgs-settings-row">
      <div className="pgs-settings-copy">
        <div className="pgs-settings-title">{t('safe.title')}</div>
        <div className="pgs-settings-description">{t('safe.description')}</div>
      </div>
      <button
        type="button"
        className="pgs-switch"
        role="switch"
        aria-label={t('safe.title')}
        aria-checked={snapshot.safeMode}
        disabled={!snapshot.ready || !snapshot.writable}
        onClick={() => { runtime.setSafeMode(!snapshot.safeMode) }}
      />
    </div>
  )
}

export const inject = ['slots', 'theme', 'locale', 'connection', 'remote', 'settingsScope']

export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(LOCALE_NAMESPACE)
  const scope = ctx.settingsScope.bind<SkinSettings>({ namespace: SETTINGS_NAMESPACE })
  const initialScheme = ctx.theme.getTheme().active.colorScheme
  const runtime = new SkinRuntime(scope, ctx.theme, initialScheme)

  // Mirror the active scheme on <body> so fixed-position surfaces outside the
  // app frame (e.g. the better-sidebar workbench) can follow light/dark art.
  const mirrorScheme = (scheme: GalleryScheme): void => {
    document.body.dataset.photowallScheme = scheme
  }
  mirrorScheme(initialScheme)

  ctx.effect(() => scope.subscribe(() => { runtime.sync() }), 'photowall-skin: settings mirror')
  ctx.on('theme/change', snapshot => {
    runtime.sync(snapshot.active.colorScheme)
    mirrorScheme(snapshot.active.colorScheme)
  })
  ctx.effect(() => () => { runtime.disposeTokensEffect() }, 'photowall-skin: token cleanup')

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.photowallSkin = ''
    style.textContent = GALLERY_STYLE
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'photowall-skin: styles')

  ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, { zh, en }), 'photowall-skin: locale')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'photowall-skin',
    order: -1000,
    inject: () => ({ runtime }),
  }, GalleryOverlay as never))

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'photowall-skin',
    order: 20,
    locale: LOCALE_NAMESPACE,
    inject: () => ({ runtime }),
  }, SettingsRow as never))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'photowall-skin',
    order: 30,
    label: () => `🎨 ${t('section.label')}`,
    locale: LOCALE_NAMESPACE,
    inject: () => ({ runtime }),
  }, SettingsPage as never))
}
