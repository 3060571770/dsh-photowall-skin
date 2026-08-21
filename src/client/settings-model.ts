import type { GalleryScheme } from '../assets.ts'
import {
  GALLERY_MODE_DRIFT, GALLERY_MODE_SINGLE, GALLERY_MODE_STATIC,
  defaultGalleryCustomization, defaultPaletteCustomization,
  defaultSidebarCustomization, type CustomImage, type GalleryCustomization,
  type PaletteCustomization, type SidebarCustomization, type ThemePair,
} from '../settings.ts'

type LooseRecord = Record<string, unknown>

function record(value: unknown): LooseRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : {}
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string'))] : []
}

function isPair(value: unknown): value is ThemePair<unknown> {
  const candidate = record(value)
  return 'dark' in candidate || 'light' in candidate
}

function schemeOf(id: string, customs: readonly CustomImage[]): GalleryScheme | undefined {
  return customs.find(image => image.id === id)?.scheme
}

function splitLegacyIds(ids: string[], customs: readonly CustomImage[]): ThemePair<string[]> {
  const dark: string[] = []
  const light: string[] = []
  for (const id of ids) {
    const scheme = schemeOf(id, customs)
    if (scheme === 'dark') dark.push(id)
    else if (scheme === 'light') light.push(id)
    else {
      // A stale custom image does not carry a scheme in old settings. Keep it
      // available in both lists until the upload roster can resolve it.
      dark.push(id)
      light.push(id)
    }
  }
  return { dark, light }
}

/** Convert legacy 0.3.x gallery settings into the 0.4 per-theme shape. */
export function normalizeGallery(value: unknown, customs: readonly CustomImage[] = []): GalleryCustomization {
  const source = record(value)
  const defaults = defaultGalleryCustomization()
  const rawEnabled = source.enabledIds
  const enabled = isPair(rawEnabled)
    ? {
        dark: strings(record(rawEnabled).dark),
        light: strings(record(rawEnabled).light),
      }
    : splitLegacyIds(strings(rawEnabled), customs)

  const rawMode = source.mode
  const mode = rawMode === GALLERY_MODE_SINGLE
    ? GALLERY_MODE_SINGLE
    : rawMode === GALLERY_MODE_STATIC
      ? GALLERY_MODE_STATIC
      : GALLERY_MODE_DRIFT
  const rawSingles = source.singleIds
  const legacySingle = typeof source.singleId === 'string' ? source.singleId : ''
  const singleIds = isPair(rawSingles)
    ? {
        dark: strings([record(rawSingles).dark])[0] ?? defaults.singleIds.dark,
        light: strings([record(rawSingles).light])[0] ?? defaults.singleIds.light,
      }
    : (() => {
        const scheme = schemeOf(legacySingle, customs)
        return {
          dark: scheme === 'dark' ? legacySingle : defaults.singleIds.dark,
          light: scheme === 'light' ? legacySingle : defaults.singleIds.light,
        }
      })()

  const rowCount = Math.min(6, Math.max(1, Math.round(Number(source.rowCount) || defaults.rowCount)))
  const speedSeconds = Math.min(120, Math.max(90, Math.round(Number(source.speedSeconds) || defaults.speedSeconds)))
  return { enabledIds: enabled, mode, singleIds, rowCount, speedSeconds }
}

/** Convert legacy 0.3.x single sidebar selection into per-theme playlists. */
export function normalizeSidebar(value: unknown, customs: readonly CustomImage[] = []): SidebarCustomization {
  const source = record(value)
  const rawImages = source.imageIds
  const imageIds = isPair(rawImages)
    ? { dark: strings(record(rawImages).dark), light: strings(record(rawImages).light) }
    : { dark: [] as string[], light: [] as string[] }
  if (!isPair(rawImages) && typeof source.imageId === 'string' && source.imageId.length > 0) {
    const scheme = schemeOf(source.imageId, customs)
    if (scheme === 'dark') imageIds.dark.push(source.imageId)
    else if (scheme === 'light') imageIds.light.push(source.imageId)
    else {
      imageIds.dark.push(source.imageId)
      imageIds.light.push(source.imageId)
    }
  }
  const interval = Math.min(120, Math.max(5, Math.round(Number(source.intervalSeconds) || defaultSidebarCustomization().intervalSeconds)))
  return { imageIds, intervalSeconds: interval }
}

export function normalizePalette(value: unknown): PaletteCustomization {
  const source = record(value)
  const defaults = defaultPaletteCustomization()
  const quick = isPair(source.quick)
    ? {
        dark: {
          seedColor: typeof record(source.quick).dark === 'object' && typeof record(record(source.quick).dark).seedColor === 'string'
            ? record(record(source.quick).dark).seedColor as string : defaults.quick.dark.seedColor,
          opacity: Number(record(record(source.quick).dark).opacity) || defaults.quick.dark.opacity,
        },
        light: {
          seedColor: typeof record(source.quick).light === 'object' && typeof record(record(source.quick).light).seedColor === 'string'
            ? record(record(source.quick).light).seedColor as string : defaults.quick.light.seedColor,
          opacity: Number(record(record(source.quick).light).opacity) || defaults.quick.light.opacity,
        },
      }
    : defaults.quick
  quick.dark.opacity = Math.min(1, Math.max(0.2, quick.dark.opacity))
  quick.light.opacity = Math.min(1, Math.max(0.2, quick.light.opacity))
  const tokens: PaletteCustomization['tokens'] = {}
  for (const [name, value] of Object.entries(record(source.tokens))) {
    const pair = record(value)
    if (typeof pair.light === 'string' && typeof pair.dark === 'string') {
      tokens[name] = { light: pair.light, dark: pair.dark }
    }
  }
  return {
    tokens,
    quick,
    presets: Array.isArray(source.presets) ? source.presets as PaletteCustomization['presets'] : [],
  }
}
