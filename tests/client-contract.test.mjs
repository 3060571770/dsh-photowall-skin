import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { ALL_ASSETS, GALLERY_ASSETS } from '../lib/assets.js'
import { GALLERY_STYLE } from '../lib/styles.js'

test('0.5 ships no built-in artwork: gallery manifests are empty', () => {
  assert.deepEqual(GALLERY_ASSETS.dark, [])
  assert.deepEqual(GALLERY_ASSETS.light, [])
  assert.equal(ALL_ASSETS.length, 0)
})

test('0.5 removes the built-in sidebar fallback and resolves uploads only', () => {
  const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  // No hardcoded session-list art URL remains in the injected CSS.
  assert.doesNotMatch(GALLERY_STYLE, /url\('\/photowall-skin\/assets\/(light|dark)\//)
  // The image layer degrades to `none` so the readability scrim survives with no art.
  assert.match(GALLERY_STYLE, /var\(--pgs-sidebar-image,\s*none\)/)
  // The gallery/sidebar resolvers draw from customImages only.
  assert.match(client, /customImages\.filter/)
})

test('gallery CSS crops without stretching or transform scaling', () => {
  assert.match(GALLERY_STYLE, /object-fit:\s*cover/)
  assert.doesNotMatch(GALLERY_STYLE, /transform:\s*scale\s*\(/)
  assert.match(GALLERY_STYLE, /\.pgs-artboard\s*\{[^}]*z-index:\s*-2/s)
  assert.doesNotMatch(GALLERY_STYLE, />\s*:\s*not\(\.pgs-artboard\)[^{]*\{[^}]*z-index/s)
  assert.match(GALLERY_STYLE, /max-width:\s*5120px/)
  assert.match(GALLERY_STYLE, /max-height:\s*2880px/)
  assert.match(GALLERY_STYLE, /data-mobile='true'[^}]+display:\s*block/s)
  assert.match(GALLERY_STYLE, /prefers-reduced-motion:\s*reduce/)
})

test('0.4 client bundle contains the per-theme gallery, sidebar carousel and palette controls', () => {
  const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(client, /singleIds/)
  assert.match(client, /rowCount/)
  assert.match(client, /intervalSeconds/)
  assert.match(client, /generateQuickTokens/)
  assert.match(client, /pgs-tabs/)
  assert.match(GALLERY_STYLE, /pgs-static-row/)
  assert.match(GALLERY_STYLE, /pgs-row:nth-child\(even\)/)
  assert.match(GALLERY_STYLE, /photowall-sidebar-transition/)
})

test('0.4.1 layering fix: sidebar column not isolated, sidebar art pinned behind content, artboard lowered', () => {
  // The settings modal lives inside the sidebar column's DOM subtree; the
  // column must not create a stacking context that traps the modal below the
  // conversation layer.
  assert.doesNotMatch(GALLERY_STYLE, /\[data-photowall-skin-frame\] > div:first-child\s*\{[^}]*isolation:\s*isolate/s)
  assert.match(GALLERY_STYLE, /0\.4\.1 layering fix/)
  assert.match(GALLERY_STYLE, /\.pgs-artboard\s*\{[^}]*z-index:\s*-2/s)
  assert.match(GALLERY_STYLE, /> div:first-child::before,[\s\S]*?z-index:\s*-1/)
})

test('0.4.9 composer-fade self-heal + hero↔active transition contract', () => {
  const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  // Column background now animates via the background-color longhand so
  // Chromium interpolates the color-mix() hero fill against host bg-base.
  assert.match(GALLERY_STYLE, /\[data-photowall-skin-frame\]\s+\[data-phase\]\s*\{[^}]*transition:\s*background-color/)
  assert.match(GALLERY_STYLE, /\[data-photowall-skin-frame\]\s+\[data-phase='hero'\]\s*\{[^}]*background-color:\s*color-mix/)
  assert.doesNotMatch(GALLERY_STYLE, /\[data-photowall-skin-frame\]\s+\[data-phase='hero'\]\s*\{[^}]*\bbackground:\s*color-mix/)
  assert.match(GALLERY_STYLE, /\[data-photowall-skin-frame\]\s+\[data-phase='active'\]\s*\{[^}]*background-color:\s*color-mix[^}]*93%/)

  // The fade stays mounted and only toggles opacity (no unmount flash).
  assert.match(GALLERY_STYLE, /\.pgs-composer-fade\s*\{[^}]*opacity:\s*0/)
  assert.match(GALLERY_STYLE, /\.pgs-composer-fade\s*\{[^}]*transition:\s*opacity/)
  assert.match(GALLERY_STYLE, /\.pgs-composer-fade\[data-visible\]\s*\{[^}]*opacity:\s*1/)

  // Reduced-motion gates the new transitions but NOT the drift wall: both
  // directions always loop at 96s.
  assert.match(GALLERY_STYLE, /prefers-reduced-motion:\s*reduce[\s\S]*?\.pgs-composer-fade\s*\{[^}]*transition:\s*none/)
  assert.match(GALLERY_STYLE, /prefers-reduced-motion:\s*reduce[\s\S]*?\[data-photowall-skin-frame\]\s+\[data-phase\]\s*\{[^}]*transition:\s*none/)
  assert.doesNotMatch(GALLERY_STYLE, /\.pgs-row\s+\.pgs-track\s*\{[^}]*animation:\s*none/)
  assert.doesNotMatch(GALLERY_STYLE, /108s/)
  assert.match(GALLERY_STYLE, /\.pgs-track\s*\{[^}]*pgs-drift-left\s+var\(--pgs-drift-duration,\s*96s\)/)

  // Drift speed rides a --pgs-drift-duration variable and a persisted
  // speedSeconds setting; the uploader accepts multiple files at once.
  assert.match(client, /--pgs-drift-duration/)
  assert.match(client, /speedSeconds/)
  assert.match(client, /multiple/)

  // Static wall reuses the drift wall's per-row distribution (no sparse
  // span-2 bento): tiles-per-row = max(4, ceil(assets/rows)), flex-filled.
  assert.doesNotMatch(GALLERY_STYLE, /grid-row:\s*span\s*2/)
  assert.match(client, /% assets\.length/)

  // The client bundle re-queries the seat/scroll on every measure, drives
  // visibility off data-phase (MutationObserver), and renders a data-visible
  // toggle instead of unmounting.
  assert.match(client, /MutationObserver/)
  assert.match(client, /data-visible/)
  assert.match(client, /data-phase/)
})

test('0.5 palette console groups tokens and shows preset swatches', () => {
  const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  // Presets render as two-tone swatch cards.
  assert.match(GALLERY_STYLE, /pgs-preset-card/)
  assert.match(GALLERY_STYLE, /pgs-preset-swatch/)
  assert.match(client, /COMMON_TOKENS/)
  assert.match(client, /pgs-token-group-heading/)
})
