export const SETTINGS_NAMESPACE = 'photowall-skin'
export const SAFE_MODE_FIELD = 'safeMode'

export const GALLERY_MODE_DRIFT = 'drift'
export const GALLERY_MODE_STATIC = 'static'
export const GALLERY_MODE_SINGLE = 'single'

/** @deprecated Kept for source compatibility while saved `grid` values migrate to `drift`. */
export const GALLERY_MODE_GRID = GALLERY_MODE_DRIFT

export type ThemePair<T> = { dark: T; light: T }
export type GalleryMode = 'drift' | 'static' | 'single'

/** One user-uploaded image served by the plugin (id unique within its scheme). */
export interface CustomImage {
  /** Stable route id (scheme-prefixed; e.g. `user-1724...`). */
  id: string
  /** File name on disk inside the uploads directory. */
  file: string
  /** Which theme palette the image belongs to. */
  scheme: 'light' | 'dark'
  width: number
  height: number
}

/** Gallery wall customization, stored independently for each color scheme. */
export interface GalleryCustomization {
  /** Gallery image ids in display order. Each theme always keeps at least one image. */
  enabledIds: ThemePair<string[]>
  /** `drift` animates the wall, `static` freezes it, `single` renders one full-bleed image. */
  mode: GalleryMode
  /** Image shown in `single` mode, separately for the dark and light theme. */
  singleIds: ThemePair<string>
  /** Number of rows used by the drifting wall, clamped to 1–6. */
  rowCount: number
  /** Seconds for one full drift loop, clamped to 90–120. */
  speedSeconds: number
  /** Dominant drift direction ('left': odd rows drift left, even rows reverse; 'right' flips both). */
  driftDirection: 'left' | 'right'
  /** @deprecated Legacy 0.3.x value, retained only so existing settings can migrate safely. */
  singleId?: string
}

/** Sidebar background customization. */
export interface SidebarCustomization {
  /** Ordered image ids for each theme. An empty list uses the bundled session-list image. */
  imageIds: ThemePair<string[]>
  /** Seconds between images when two or more images are selected. */
  intervalSeconds: number
  /** @deprecated Legacy 0.3.x single image value. */
  imageId?: string | null
}

/** One adjustable skin color (light/dark values, CSS color strings). */
export interface PaletteColor {
  light: string
  dark: string
}

/** Free-form palette: skin token name → light/dark pair. */
export interface PaletteCustomization {
  tokens: Record<string, PaletteColor>
  quick: ThemePair<{ seedColor: string; opacity: number }>
  presets: CustomPalettePreset[]
}

export interface CustomPalettePreset {
  id: string
  name: string
  tokens: Record<string, PaletteColor>
  quick: ThemePair<{ seedColor: string; opacity: number }>
}

export interface SkinSettings {
  safeMode: boolean
  gallery: GalleryCustomization
  sidebar: SidebarCustomization
  palette: PaletteCustomization
}

export function themePair<T>(dark: T, light: T): ThemePair<T> {
  return { dark, light }
}

export function defaultGalleryCustomization(): GalleryCustomization {
  return {
    enabledIds: themePair([], []),
    mode: GALLERY_MODE_DRIFT,
    singleIds: themePair('', ''),
    rowCount: 2,
    speedSeconds: 96,
    driftDirection: 'left',
  }
}

export function defaultSidebarCustomization(): SidebarCustomization {
  return {
    imageIds: themePair([], []),
    intervalSeconds: 30,
  }
}

export function defaultPaletteCustomization(): PaletteCustomization {
  return {
    tokens: {},
    quick: themePair(
      { seedColor: '#D7967B', opacity: 0.76 },
      { seedColor: '#9F4C3E', opacity: 0.76 },
    ),
    presets: [],
  }
}

export function defaultSettings(): SkinSettings {
  return {
    safeMode: false,
    gallery: defaultGalleryCustomization(),
    sidebar: defaultSidebarCustomization(),
    palette: defaultPaletteCustomization(),
  }
}
