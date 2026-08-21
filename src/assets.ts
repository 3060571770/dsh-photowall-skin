export const ASSET_ROUTE_PREFIX = '/photowall-skin/assets'

export type GalleryScheme = 'light' | 'dark'

export interface GalleryAsset {
  id: string
  file: string
  folder: string
  scheme: GalleryScheme
  width: number
  height: number
  tablet: boolean
  mobile: boolean
}

/** The skin ships with no built-in artwork: the gallery wall and sidebar art
 *  are filled entirely by user uploads (served through the same route). These
 *  manifests stay empty so the client resolve paths degrade to "no art". */
export const GALLERY_ASSETS: Readonly<Record<GalleryScheme, readonly GalleryAsset[]>> = Object.freeze({
  dark: Object.freeze([] as GalleryAsset[]),
  light: Object.freeze([] as GalleryAsset[]),
})

export const ALL_ASSETS: readonly GalleryAsset[] = Object.freeze([])

export function assetUrl(asset: GalleryAsset): string {
  return `${ASSET_ROUTE_PREFIX}/${asset.scheme}/${encodeURIComponent(asset.file)}`
}
