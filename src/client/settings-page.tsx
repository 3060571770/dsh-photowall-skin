import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { assetUrl, type GalleryAsset, type GalleryScheme } from '../assets.ts'
import {
  GALLERY_MODE_DRIFT, GALLERY_MODE_SINGLE, GALLERY_MODE_STATIC,
  defaultGalleryCustomization, defaultPaletteCustomization, defaultSettings,
  defaultSidebarCustomization, type CustomImage, type GalleryCustomization,
  type PaletteCustomization, type SkinSettings,
} from '../settings.ts'
import { BUILTIN_PALETTE_PRESETS, builtinTokens, generateQuickTokens } from './palette.ts'
import { normalizeGallery, normalizePalette, normalizeSidebar } from './settings-model.ts'
import { COMMON_TOKENS, TOKEN_GROUPS, TOKEN_LABEL_KEYS, TOKENS } from './tokens.ts'
import type { SkinRuntime } from './index.tsx'

interface SettingsPageProps {
  runtime: SkinRuntime
  t: (key: string) => string
}

type Tab = 'gallery' | 'sidebar' | 'palette' | 'other'

function splitColor(value: string): { rgb: string; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (hex) return { rgb: value, alpha: 1 }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value)
  if (rgba) {
    const r = Number(rgba[1]).toString(16).padStart(2, '0')
    const g = Number(rgba[2]).toString(16).padStart(2, '0')
    const b = Number(rgba[3]).toString(16).padStart(2, '0')
    return { rgb: `#${r}${g}${b}`, alpha: Math.min(1, Math.max(0, rgba[4] === undefined ? 1 : Number(rgba[4]))) }
  }
  return { rgb: '#888888', alpha: 1 }
}

function composeColor(pickedHex: string, alpha: number): string {
  if (alpha >= 1) return pickedHex
  const r = parseInt(pickedHex.slice(1, 3), 16)
  const g = parseInt(pickedHex.slice(3, 5), 16)
  const b = parseInt(pickedHex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image decode failed'))
    }
    image.src = url
  })
}

function extensionOf(file: File): 'jpg' | 'png' | 'webp' | undefined {
  const name = file.name.toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg'
  if (name.endsWith('.png')) return 'png'
  if (name.endsWith('.webp')) return 'webp'
  return undefined
}

function uploadFile(
  file: File,
  scheme: GalleryScheme,
  onProgress: (progress: number) => void,
  t: (key: string) => string,
): Promise<CustomImage> {
  return new Promise(async (resolve, reject) => {
    try {
      const ext = extensionOf(file)
      if (ext === undefined) throw new Error(t('upload.error.ext'))
      if (file.size > 12 * 1024 * 1024) throw new Error(t('upload.error.size'))
      const { width, height } = await readImageSize(file)
      const query = new URLSearchParams({ scheme, width: String(width), height: String(height), ext })
      const request = new XMLHttpRequest()
      request.open('POST', `/photowall-skin/api/upload?${query.toString()}`)
      request.responseType = 'json'
      request.upload.onprogress = event => {
        if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100))
      }
      request.onerror = () => reject(new Error(t('upload.error.connection')))
      request.onload = () => {
        const body = request.response as { ok?: boolean; image?: CustomImage; error?: string } | null
        if (request.status >= 200 && request.status < 300 && body?.ok && body.image !== undefined) resolve(body.image)
        else reject(new Error(body?.error ?? t('upload.error.failed')))
      }
      request.send(file)
    } catch (error) {
      reject(error)
    }
  })
}

function arrayMove(ids: string[], id: string, targetId: string): string[] {
  const from = ids.indexOf(id)
  const target = ids.indexOf(targetId)
  if (from < 0 || target < 0 || from === target) return ids
  const next = [...ids]
  next.splice(from, 1)
  next.splice(target, 0, id)
  return next
}

function ThemeToggle({ scheme, setScheme, t }: { scheme: GalleryScheme; setScheme: (scheme: GalleryScheme) => void; t: (key: string) => string }) {
  return (
    <div className="pgs-theme-toggle" role="group" aria-label={t('theme.pick')}>
      {(['dark', 'light'] as const).map(item => (
        <button key={item} type="button" className={item === scheme ? 'is-active' : ''} onClick={() => setScheme(item)}>
          {item === 'dark' ? t('palette.dark') : t('palette.light')}
        </button>
      ))}
    </div>
  )
}

/** One palette token row: color swatch, alpha slider and raw value. */
function TokenRow({ name, label, color, scheme, onToken }: {
  name: string
  label: string
  color: string
  scheme: GalleryScheme
  onToken: (name: string, scheme: GalleryScheme, value: string) => void
}) {
  const parsed = splitColor(color)
  return (
    <tr>
      <td className="pgs-token-name">{label}</td>
      <td>
        <input type="color" value={parsed.rgb} onChange={event => onToken(name, scheme, composeColor(event.target.value, parsed.alpha))} />
        <input className="pgs-alpha-input" type="range" min="0" max="100" value={Math.round(parsed.alpha * 100)} onChange={event => onToken(name, scheme, composeColor(parsed.rgb, Number(event.target.value) / 100))} />
        <input className="pgs-color-text" type="text" value={color} onChange={event => onToken(name, scheme, event.target.value)} />
      </td>
    </tr>
  )
}

export function SettingsPage({ runtime, t }: SettingsPageProps) {
  const subscribeRuntime = useCallback((onStoreChange: () => void) => runtime.subscribe(onStoreChange), [runtime])
  const settings = useSyncExternalStore(subscribeRuntime, runtime.getRaw, runtime.getRaw)
  const [tab, setTab] = useState<Tab>('gallery')
  const [themeScheme, setThemeScheme] = useState<GalleryScheme>('dark')
  const [customs, setCustoms] = useState<CustomImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [draggingUpload, setDraggingUpload] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [presetName, setPresetName] = useState('')
  const fileInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let alive = true
    void runtime.refreshCustomImages().then(images => { if (alive) setCustoms(images) })
    return () => { alive = false }
  }, [runtime])

  const gallery = normalizeGallery(settings.gallery, customs)
  const sidebar = normalizeSidebar(settings.sidebar, customs)
  const palette = normalizePalette(settings.palette)

  const setGallery = (next: GalleryCustomization): void => runtime.update({ ...settings, gallery: next })
  const setSidebar = (next: ReturnType<typeof normalizeSidebar>): void => runtime.update({ ...settings, sidebar: next })
  const setPalette = (next: PaletteCustomization): void => runtime.update({ ...settings, palette: next })

  const schemeAssets: Record<GalleryScheme, { id: string; url: string; custom: boolean }[]> = {
    dark: customs.filter(image => image.scheme === 'dark').map(image => ({ id: image.id, url: assetUrl(image as unknown as GalleryAsset), custom: true })),
    light: customs.filter(image => image.scheme === 'light').map(image => ({ id: image.id, url: assetUrl(image as unknown as GalleryAsset), custom: true })),
  }
  const activeAssets = schemeAssets[themeScheme]
  const activeEnabled = gallery.enabledIds[themeScheme]
  const activePreview = activeAssets.find(asset => activeEnabled.includes(asset.id)) ?? activeAssets[0]

  // Library order mirrors the wall: enabled images first in the user's
  // configured order, then the remaining (disabled) images in catalog order.
  const orderedAssets = [
    ...activeEnabled.flatMap(id => {
      const asset = activeAssets.find(item => item.id === id)
      return asset === undefined ? [] : [asset]
    }),
    ...activeAssets.filter(asset => !activeEnabled.includes(asset.id)),
  ]
  // The sidebar tab mirrors the sidebar carousel order instead.
  const orderedSidebarAssets = [
    ...sidebar.imageIds[themeScheme].flatMap(id => {
      const asset = activeAssets.find(item => item.id === id)
      return asset === undefined ? [] : [asset]
    }),
    ...activeAssets.filter(asset => !sidebar.imageIds[themeScheme].includes(asset.id)),
  ]

  const toggleGalleryImage = (id: string): void => {
    const current = gallery.enabledIds[themeScheme]
    if (current.includes(id) && current.length === 1) return
    const enabledIds = { ...gallery.enabledIds, [themeScheme]: current.includes(id) ? current.filter(item => item !== id) : [...current, id] }
    setGallery({ ...gallery, enabledIds })
  }

  const moveGalleryImage = (id: string, targetId: string): void => {
    setGallery({ ...gallery, enabledIds: { ...gallery.enabledIds, [themeScheme]: arrayMove(gallery.enabledIds[themeScheme], id, targetId) } })
  }

  const removeCustom = async (id: string): Promise<void> => {
    if (!window.confirm(t('gallery.remove-confirm'))) return
    const response = await fetch(`/photowall-skin/api/remove?id=${encodeURIComponent(id)}`, { method: 'POST' })
    const body = await response.json() as { ok?: boolean; error?: string }
    if (!body.ok) {
      setUploadError(body.error ?? t('gallery.remove-failed'))
      return
    }
    const nextGallery = {
      ...gallery,
      enabledIds: {
        dark: gallery.enabledIds.dark.filter(item => item !== id),
        light: gallery.enabledIds.light.filter(item => item !== id),
      },
      singleIds: {
        dark: gallery.singleIds.dark === id ? '' : gallery.singleIds.dark,
        light: gallery.singleIds.light === id ? '' : gallery.singleIds.light,
      },
    }
    const nextSidebar = {
      ...sidebar,
      imageIds: {
        dark: sidebar.imageIds.dark.filter(item => item !== id),
        light: sidebar.imageIds.light.filter(item => item !== id),
      },
    }
    // One combined update so the gallery and sidebar changes cannot clobber
    // each other through a stale `settings` closure.
    runtime.update({ ...settings, gallery: nextGallery, sidebar: nextSidebar })
    setCustoms(await runtime.refreshCustomImages())
  }

  const removeAllCustom = async (): Promise<void> => {
    if (!window.confirm(t('gallery.clear-confirm'))) return
    const response = await fetch('/photowall-skin/api/clear', { method: 'POST' })
    const body = await response.json() as { ok?: boolean; error?: string }
    if (!body.ok) {
      setUploadError(body.error ?? t('gallery.remove-failed'))
      return
    }
    // Clear every selection in one update so the gallery and sidebar stay
    // consistent and no stale closure can resurrect an old list.
    runtime.update({
      ...settings,
      gallery: { ...gallery, enabledIds: { dark: [], light: [] }, singleIds: { dark: '', light: '' } },
      sidebar: { ...sidebar, imageIds: { dark: [], light: [] } },
    })
    setCustoms(await runtime.refreshCustomImages())
  }

  const upload = async (files: FileList | readonly File[]): Promise<void> => {
    const list = Array.from(files).filter((file): file is File => file instanceof File)
    if (list.length === 0 || uploading) return
    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    const added: string[] = []
    for (let index = 0; index < list.length; index++) {
      const file = list[index]!
      try {
        const image = await uploadFile(file, themeScheme, progress => {
          setUploadProgress(Math.round((index + progress / 100) / list.length * 100))
        }, t)
        if (!added.includes(image.id)) added.push(image.id)
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : String(error))
      }
    }
    if (added.length > 0) {
      const current = gallery.enabledIds[themeScheme]
      const merged = [...current, ...added.filter(id => !current.includes(id))]
      setGallery({ ...gallery, enabledIds: { ...gallery.enabledIds, [themeScheme]: merged } })
    }
    setCustoms(await runtime.refreshCustomImages())
    if (fileInput.current !== null) fileInput.current.value = ''
    setUploadProgress(100)
    setUploading(false)
  }

  const toggleSidebarImage = (id: string): void => {
    const current = sidebar.imageIds[themeScheme]
    setSidebar({ ...sidebar, imageIds: { ...sidebar.imageIds, [themeScheme]: current.includes(id) ? current.filter(item => item !== id) : [...current, id] } })
  }

  const moveSidebarImage = (id: string, targetId: string): void => {
    setSidebar({ ...sidebar, imageIds: { ...sidebar.imageIds, [themeScheme]: arrayMove(sidebar.imageIds[themeScheme], id, targetId) } })
  }

  const setQuick = (scheme: GalleryScheme, patch: Partial<PaletteCustomization['quick']['dark']>): void => {
    const quick = { ...palette.quick, [scheme]: { ...palette.quick[scheme], ...patch } }
    setPalette({ ...palette, quick, tokens: generateQuickTokens(quick) })
  }

  const setToken = (name: string, scheme: GalleryScheme, value: string): void => {
    const current = palette.tokens[name] ?? TOKENS[name]!
    setPalette({ ...palette, tokens: { ...palette.tokens, [name]: { ...current, [scheme]: value } } })
  }

  const applyBuiltinPreset = (id: string): void => {
    const preset = BUILTIN_PALETTE_PRESETS.find(item => item.id === id)
    if (preset === undefined) return
    setPalette({ ...palette, quick: preset.quick, tokens: builtinTokens(id, preset.quick) })
  }

  const savePreset = (): void => {
    const name = presetName.trim()
    if (name === '') return
    const existing = palette.presets.find(item => item.name === name)
    if (existing !== undefined && !window.confirm(t('palette.replace-confirm'))) return
    const item = { id: existing?.id ?? `preset-${Date.now().toString(36)}`, name, tokens: palette.tokens, quick: palette.quick }
    const presets = existing === undefined ? [...palette.presets, item] : palette.presets.map(candidate => candidate.id === existing.id ? item : candidate)
    setPalette({ ...palette, presets })
    setPresetName('')
  }

  const resetAll = (): void => {
    if (!window.confirm(t('other.reset-all-confirm'))) return
    runtime.update(defaultSettings())
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'gallery', label: t('tab.gallery') }, { id: 'sidebar', label: t('tab.sidebar') },
    { id: 'palette', label: t('tab.palette') }, { id: 'other', label: t('tab.other') },
  ]

  return (
    <div className="pgs-page">
      <div className="pgs-page-description">{t('section.description')}</div>
      <div className="pgs-tabs" role="tablist" aria-label={t('section.label')}>
        {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </div>

      {tab === 'gallery' && (
        <section className="pgs-page-section">
          <div className="pgs-gallery-hero" style={activePreview === undefined ? undefined : { '--pgs-preview-image': `url("${activePreview.url}")` } as React.CSSProperties}>
            <div><span>{t('gallery.preview')}</span><strong>{t(`gallery.mode-${gallery.mode}`)}</strong></div>
          </div>
          <div className="pgs-mode-cards">
            {([
              [GALLERY_MODE_DRIFT, 'gallery.mode-drift', 'gallery.mode-drift-note'],
              [GALLERY_MODE_STATIC, 'gallery.mode-static', 'gallery.mode-static-note'],
              [GALLERY_MODE_SINGLE, 'gallery.mode-single', 'gallery.mode-single-note'],
            ] as const).map(([mode, title, note]) => (
              <button key={mode} type="button" className={`pgs-mode-card${gallery.mode === mode ? ' is-active' : ''}`} onClick={() => setGallery({ ...gallery, mode })}>
                <strong>{t(title)}</strong><span>{t(note)}</span>
              </button>
            ))}
          </div>
          <ThemeToggle scheme={themeScheme} setScheme={setThemeScheme} t={t} />
          {(gallery.mode === GALLERY_MODE_DRIFT || gallery.mode === GALLERY_MODE_STATIC) && (
            <label className="pgs-range-field">
              <span>{t('gallery.rows')} <b>{gallery.rowCount}</b></span>
              <input type="range" min="1" max="6" value={gallery.rowCount} onChange={event => setGallery({ ...gallery, rowCount: Number(event.target.value) })} />
            </label>
          )}
          {gallery.mode === GALLERY_MODE_DRIFT && (
            <label className="pgs-range-field">
              <span>{t('gallery.speed')} <b>{gallery.speedSeconds}s</b></span>
              <input type="range" min="90" max="120" step="1" value={gallery.speedSeconds} onChange={event => setGallery({ ...gallery, speedSeconds: Number(event.target.value) })} />
            </label>
          )}
          {gallery.mode === GALLERY_MODE_SINGLE && (
            <label className="pgs-select-field">
              <span>{t('gallery.single-pick')}</span>
              <select className="pgs-select" value={gallery.singleIds[themeScheme]} onChange={event => setGallery({ ...gallery, singleIds: { ...gallery.singleIds, [themeScheme]: event.target.value } })}>
                {activeAssets.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
              </select>
            </label>
          )}
          <div className="pgs-page-heading-row"><div><h3 className="pgs-page-heading">{t('gallery.library')}</h3><span className="pgs-page-note">{t('gallery.library-note')}</span></div><button type="button" className="pgs-remove" disabled={customs.length === 0} onClick={() => { void removeAllCustom() }}>{t('gallery.clear')}</button></div>
          <ul className="pgs-image-list pgs-card-list">
            {orderedAssets.map(item => {
              const enabled = activeEnabled.includes(item.id)
              const index = activeEnabled.indexOf(item.id)
              return (
                <li key={item.id} draggable onDragStart={() => setDraggedId(item.id)} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedId !== null) moveGalleryImage(draggedId, item.id); setDraggedId(null) }} className={`pgs-image-item${enabled ? ' is-enabled' : ''}`}>
                  <img className="pgs-thumb" src={item.url} alt={item.id} loading="lazy" decoding="async" />
                  <span className="pgs-image-name">{item.id}</span>
                  <span className="pgs-image-actions">
                    <label className="pgs-check"><input type="checkbox" checked={enabled} disabled={enabled && activeEnabled.length === 1} onChange={() => toggleGalleryImage(item.id)} /><span>{t('gallery.enabled')}</span></label>
                    <span className="pgs-order"><button type="button" disabled={index <= 0} aria-label={t('gallery.move-up')} onClick={() => moveGalleryImage(item.id, activeEnabled[index - 1]!)}>↑</button><button type="button" disabled={index < 0 || index >= activeEnabled.length - 1} aria-label={t('gallery.move-down')} onClick={() => moveGalleryImage(item.id, activeEnabled[index + 1]!)}>↓</button></span>
                    {item.custom && <button type="button" className="pgs-remove" aria-label={t('gallery.remove')} onClick={() => { void removeCustom(item.id) }}>✕</button>}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className={`pgs-dropzone${draggingUpload ? ' is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDraggingUpload(true) }} onDragLeave={() => setDraggingUpload(false)} onDrop={event => { event.preventDefault(); setDraggingUpload(false); void upload(event.dataTransfer.files) }}>
            <strong>{t('gallery.upload')}</strong><span>{t('gallery.upload-note')}</span>
            <button type="button" className="pgs-button" disabled={uploading} onClick={() => fileInput.current?.click()}>{t('gallery.choose-file')}</button>
            <input ref={fileInput} className="pgs-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={event => { if (event.target.files !== null) void upload(event.target.files) }} />
            {uploading && <div className="pgs-upload-progress"><i style={{ width: `${uploadProgress}%` }} /><span>{uploadProgress}%</span></div>}
            {uploadError !== null && <span className="pgs-upload-error">{uploadError}</span>}
          </div>
        </section>
      )}

      {tab === 'sidebar' && (
        <section className="pgs-page-section">
          <div className="pgs-page-heading-row"><div><h3 className="pgs-page-heading">{t('sidebar.title')}</h3><p className="pgs-page-note">{t('sidebar.note')}</p></div></div>
          <ThemeToggle scheme={themeScheme} setScheme={setThemeScheme} t={t} />
          <label className="pgs-range-field"><span>{t('sidebar.interval')} <b>{sidebar.intervalSeconds}s</b></span><input type="range" min="5" max="120" step="5" disabled={sidebar.imageIds[themeScheme].length < 2} value={sidebar.intervalSeconds} onChange={event => setSidebar({ ...sidebar, intervalSeconds: Number(event.target.value) })} /></label>
          <ul className="pgs-image-list pgs-card-list">
            {orderedSidebarAssets.map(item => {
              const selected = sidebar.imageIds[themeScheme].includes(item.id)
              return <li key={item.id} draggable onDragStart={() => setDraggedId(item.id)} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedId !== null) moveSidebarImage(draggedId, item.id); setDraggedId(null) }} className={`pgs-image-item${selected ? ' is-enabled' : ''}`}><img className="pgs-thumb" src={item.url} alt="" loading="lazy" decoding="async" /><span className="pgs-image-name">{item.id}</span><span className="pgs-image-actions"><label className="pgs-check"><input type="checkbox" checked={selected} onChange={() => toggleSidebarImage(item.id)} /><span>{t('sidebar.use')}</span></label></span></li>
            })}
          </ul>
        </section>
      )}

      {tab === 'palette' && (
        <section className="pgs-page-section">
          <div className="pgs-page-heading-row"><div><h3 className="pgs-page-heading">{t('palette.quick-title')}</h3><p className="pgs-page-note">{t('palette.quick-note')}</p></div><button type="button" className="pgs-reset" onClick={() => setPalette(defaultPaletteCustomization())}>{t('palette.reset')}</button></div>
          <div className="pgs-preset-grid">
            {BUILTIN_PALETTE_PRESETS.map(item => (
              <button key={item.id} type="button" className="pgs-preset-card" onClick={() => applyBuiltinPreset(item.id)}>
                <span className="pgs-preset-swatch" style={{ '--pgs-swatch-dark': item.quick.dark.seedColor, '--pgs-swatch-light': item.quick.light.seedColor } as React.CSSProperties} />
                <span>{t(item.name)}</span>
              </button>
            ))}
          </div>
          <div className="pgs-quick-colors">
            {(['dark', 'light'] as const).map(scheme => <div key={scheme} className="pgs-quick-color"><strong>{scheme === 'dark' ? t('palette.dark') : t('palette.light')}</strong><label><span>{t('palette.seed')}</span><input type="color" value={splitColor(palette.quick[scheme].seedColor).rgb} onChange={event => setQuick(scheme, { seedColor: event.target.value })} /></label><label className="pgs-range-field"><span>{t('palette.opacity')} <b>{Math.round(palette.quick[scheme].opacity * 100)}%</b></span><input type="range" min="20" max="100" value={Math.round(palette.quick[scheme].opacity * 100)} onChange={event => setQuick(scheme, { opacity: Number(event.target.value) / 100 })} /></label></div>)}
          </div>
          <p className="pgs-page-note">{t('palette.quick-hint')}</p>
          <div className="pgs-page-heading-row"><h3 className="pgs-page-heading">{t('palette.common')}</h3></div>
          <table className="pgs-palette">
            <thead><tr><th>{t('palette.component')}</th><th>{themeScheme === 'dark' ? t('palette.dark') : t('palette.light')}</th></tr></thead>
            <tbody>
              {COMMON_TOKENS.map(name => {
                const current = palette.tokens[name] ?? TOKENS[name]!
                return <TokenRow key={name} name={name} label={t(TOKEN_LABEL_KEYS[name] ?? name)} color={current[themeScheme]} scheme={themeScheme} onToken={setToken} />
              })}
            </tbody>
          </table>
          <div className="pgs-preset-save"><input type="text" value={presetName} placeholder={t('palette.preset-name')} onChange={event => setPresetName(event.target.value)} /><button type="button" className="pgs-button" disabled={presetName.trim() === ''} onClick={savePreset}>{t('palette.save')}</button></div>
          {palette.presets.length > 0 && <div className="pgs-custom-presets">{palette.presets.map(item => <span key={item.id}><button type="button" className="pgs-preset" onClick={() => setPalette({ ...palette, tokens: item.tokens, quick: item.quick })}>{item.name}</button><button type="button" className="pgs-preset-delete" aria-label={t('palette.delete-preset')} onClick={() => { if (window.confirm(t('palette.delete-confirm'))) setPalette({ ...palette, presets: palette.presets.filter(candidate => candidate.id !== item.id) }) }}>×</button></span>)}</div>}
          <div className="pgs-page-heading-row"><h3 className="pgs-page-heading">{t('palette.advanced')}</h3><button type="button" className="pgs-reset" onClick={() => setShowAdvanced(value => !value)}>{showAdvanced ? t('palette.collapse') : t('palette.expand')}</button></div>
          {showAdvanced && <>
            <ThemeToggle scheme={themeScheme} setScheme={setThemeScheme} t={t} />
            {TOKEN_GROUPS.map(group => (
              <div key={group.key}>
                <div className="pgs-token-group-heading">{t(group.label)}</div>
                <table className="pgs-palette">
                  <tbody>
                    {group.tokens.map(name => {
                      const current = palette.tokens[name] ?? TOKENS[name]!
                      return <TokenRow key={name} name={name} label={t(TOKEN_LABEL_KEYS[name] ?? name)} color={current[themeScheme]} scheme={themeScheme} onToken={setToken} />
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </>}
        </section>
      )}

      {tab === 'other' && (
        <section className="pgs-page-section">
          <div className="pgs-action-card"><div><strong>{t('safe.title')}</strong><span>{t('safe.description')}</span></div><button type="button" className={`pgs-switch${settings.safeMode ? ' is-on' : ''}`} role="switch" aria-checked={settings.safeMode} onClick={() => runtime.setSafeMode(!settings.safeMode)} /></div>
          <div className="pgs-action-card"><div><strong>{t('other.reset-gallery')}</strong><span>{t('other.reset-gallery-note')}</span></div><button type="button" className="pgs-reset" onClick={() => setGallery(defaultGalleryCustomization())}>{t('palette.reset')}</button></div>
          <div className="pgs-action-card"><div><strong>{t('other.reset-sidebar')}</strong><span>{t('other.reset-sidebar-note')}</span></div><button type="button" className="pgs-reset" onClick={() => setSidebar(defaultSidebarCustomization())}>{t('palette.reset')}</button></div>
          <div className="pgs-action-card"><div><strong>{t('other.reset-all')}</strong><span>{t('other.reset-all-note')}</span></div><button type="button" className="pgs-remove" onClick={resetAll}>{t('other.reset-all')}</button></div>
          <p className="pgs-page-note">{t('other.compatibility')}</p>
        </section>
      )}
    </div>
  )
}
