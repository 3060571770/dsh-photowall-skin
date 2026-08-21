export const GALLERY_STYLE = String.raw`
style[data-photowall-skin] { display: none; }

.pgs-marker {
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none !important;
}

[data-photowall-skin-frame] {
  isolation: isolate;
}

.pgs-artboard {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  max-width: 5120px;
  max-height: 2880px;
  margin: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: none;
  background: var(--pgs-canvas);
  opacity: 1;
  animation: pgs-enter 160ms ease-out;
}

.pgs-row {
  min-width: 0;
  min-height: 0;
  flex: 1 1 50%;
  overflow: hidden;
}

.pgs-track {
  display: flex;
  width: 200%;
  height: 100%;
  will-change: transform;
  animation: pgs-drift-left var(--pgs-drift-duration, 96s) linear infinite;
}

.pgs-row:nth-child(even) .pgs-track {
  animation-name: pgs-drift-right;
}

/* Drift direction: when the artboard carries data-drift-direction='right', swap
   the odd/even keyframe names so the whole wall drifts the other way. */
.pgs-artboard[data-drift-direction='right'] .pgs-track {
  animation-name: pgs-drift-right;
}

.pgs-artboard[data-drift-direction='right'] .pgs-row:nth-child(even) .pgs-track {
  animation-name: pgs-drift-left;
}

.pgs-sequence {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex: 0 0 50%;
}

.pgs-tile {
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1 1 0;
  margin: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--pgs-edge) 52%, transparent);
  background: var(--pgs-fallback);
}

.pgs-image {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  object-position: 50% 50%;
}

/* Single-image mode: one full-bleed frame, no tracks. */
.pgs-artboard-single .pgs-image-single {
  flex: 1 1 auto;
  min-height: 0;
}

/* Static wall: each row is a flex container that splits its width among the
   tiles. The tile count per row is computed from asset count ÷ row count (the
   same assetsForRow as the drift wall), so more images spread wider instead
   of a fixed 4 columns. */
.pgs-static-row {
  display: flex;
}

.pgs-scrim {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: var(--pgs-scrim);
}

/* hero↔active 列背景透明度过渡：只用 background-color 长属性，Chromium
   才能对 color-mix(...) 的解析结果与宿主 bg-base 做平滑插值。 */
[data-photowall-skin-frame] [data-phase] {
  transition: background-color 260ms ease;
}

[data-photowall-skin-frame] [data-phase='hero'] {
  background-color: color-mix(in srgb, var(--dsw-alias-bg-base) 80%, transparent);
}

/* active 正文态：比 hero 更不透明以保文字可读，但比宿主默认 0.82/0.84 略透
   一点（93% ≈ 0.76/0.78），让作品墙在正文间隙透出。 */
[data-photowall-skin-frame] [data-phase='active'] {
  background-color: color-mix(in srgb, var(--dsw-alias-bg-base) 93%, transparent);
}

[data-photowall-skin-frame] [data-composer-card] {
  border-color: var(--dsw-alias-border-l2);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 66%, transparent);
  box-shadow: 0 18px 48px color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent), inset 0 1px color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);
  -webkit-backdrop-filter: blur(22px) saturate(126%);
  backdrop-filter: blur(22px) saturate(126%);
}

/* ── Left sidebar (workspaces + session list): full-bleed art with a
   readability scrim. The image URL rides the --pgs-sidebar-image variable
   (set by the client runtime from the user's uploads). The column's own fill
   and the ui-sidebar root both read the --dsw-specific-sidebar-fill token,
   so overriding it to transparent lets the art show through while every
   inner surface still resolves a value. */
[data-photowall-skin-frame] > div:first-child {
  position: relative;
  --dsw-specific-sidebar-fill: transparent;
  background-color: transparent;
  border-right: none;
}

[data-photowall-skin-frame] > div:first-child::before,
[data-photowall-skin-frame] > div:first-child::after {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0;
  pointer-events: none;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* Crossfade: ::before holds the previous image (static), ::after holds the
   current image and fades in over it. Each layer carries the readability
   scrim as its first background image, so the scrim is always pixel-aligned
   with the artwork it covers. */
[data-photowall-skin-frame] > div:first-child::before {
  background-image:
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--dsw-alias-bg-base) 70%, transparent) 0%,
      color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent) 50%,
      color-mix(in srgb, var(--dsw-alias-bg-base) 70%, transparent) 100%
    ), var(--pgs-sidebar-image-previous, var(--pgs-sidebar-image, none));
}

[data-photowall-skin-frame] > div:first-child::after {
  background-image:
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--dsw-alias-bg-base) 70%, transparent) 0%,
      color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent) 50%,
      color-mix(in srgb, var(--dsw-alias-bg-base) 70%, transparent) 100%
    ), var(--pgs-sidebar-image, none);
  opacity: 0;
  transition: opacity 800ms ease;
}

[data-photowall-skin-frame][data-photowall-sidebar-transition] > div:first-child::after {
  opacity: 1;
}

/* "Hide artwork background" also retires the sidebar art. */
[data-photowall-skin-frame][data-photowall-safe] > div:first-child::before,
[data-photowall-skin-frame][data-photowall-safe] > div:first-child::after {
  display: none;
}

/* ── better-sidebar workbench: translucent like the main area but less so.
   Variable-scope override — the plugin's panels read the generic layer
   tokens, so redefining them on the plugin host reskins it without touching
   the rest of the app. The [class*='panel'] selectors target the CSS-module
   scoped class names (e.g. nArs4W_panel / nArs4W_bottomPanel) to add the
   frosted-glass backdrop. */
[data-dsh-better-sidebar] {
  --dsw-alias-bg-layer-1: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 74%, transparent);
  --dsw-alias-bg-layer-2: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 77%, transparent);
  --dsw-alias-bg-layer-3: color-mix(in srgb, var(--dsw-alias-bg-layer-3) 80%, transparent);
}

[data-dsh-better-sidebar] [class*='panel'],
[data-dsh-better-sidebar] [class*='Panel'] {
  -webkit-backdrop-filter: blur(18px) saturate(120%);
  backdrop-filter: blur(18px) saturate(120%);
}

/* ── Conversation messages: frosted glass bubbles. The user bubble reads the
   --dsw-specific-bubble token (overridden in the theme tokens for a
   translucent fill); the assistant narration gets its own glass container.
   Nodes carry a stable data-chat-flow-kind attribute. */
[data-photowall-skin-frame] [data-chat-flow-kind='user'] [class*='bubble'],
[data-photowall-skin-frame] [data-chat-flow-kind='steering'] [class*='bubble'] {
  -webkit-backdrop-filter: blur(18px) saturate(125%);
  backdrop-filter: blur(18px) saturate(125%);
  border: 1px solid var(--dsw-alias-border-l1);
}

[data-photowall-skin-frame] [data-chat-flow-kind='assistant-step'] {
  background: color-mix(in srgb, var(--dsw-specific-bubble) 67%, transparent);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 18px;
  padding: 12px 16px;
  -webkit-backdrop-filter: blur(18px) saturate(118%);
  backdrop-filter: blur(18px) saturate(118%);
}

.pgs-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}

.pgs-settings-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pgs-settings-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 22px;
}

.pgs-settings-description {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.pgs-switch {
  position: relative;
  flex: 0 0 auto;
  width: 40px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.pgs-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-label-primary);
  transition: translate 120ms ease;
}

.pgs-switch[aria-checked='true'] {
  border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-brand-primary);
}

.pgs-switch[aria-checked='true']::after {
  translate: 18px 0;
  background: var(--dsw-alias-label-primary-foreground);
}

.pgs-switch:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 3px;
}

.pgs-switch:disabled {
  cursor: not-allowed;
  opacity: .45;
}

@media (max-width: 1023px), (orientation: portrait) {
  .pgs-tile[data-tablet='false'] {
    display: none;
  }
}

@media (max-width: 599px) {
  .pgs-tile[data-mobile='true'] {
    display: block;
  }

  .pgs-tile[data-mobile='false'] {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pgs-artboard {
    animation: none;
  }

  .pgs-switch,
  .pgs-switch::after {
    transition: none;
  }

  .pgs-composer-fade {
    transition: none;
  }

  [data-photowall-skin-frame] [data-phase] {
    transition: none;
  }
}

@keyframes pgs-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pgs-drift-left {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-50%, 0, 0); }
}

@keyframes pgs-drift-right {
  from { transform: translate3d(-50%, 0, 0); }
  to { transform: translate3d(0, 0, 0); }
}

/* ── Settings page (skin customization) ─────────────────────────────────── */

.pgs-page {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 4px 0 12px;
  max-width: 640px;
}

.pgs-page-description {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
}

.pgs-page-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pgs-page-heading {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.pgs-page-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pgs-page-note {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.pgs-image-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

.pgs-image-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  opacity: .82;
}

.pgs-image-item.is-enabled {
  opacity: 1;
  border-color: var(--dsw-alias-brand-primary);
}

.pgs-thumb {
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
}

.pgs-image-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.pgs-image-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.pgs-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}

.pgs-order {
  display: inline-flex;
  gap: 4px;
}

.pgs-order button,
.pgs-remove,
.pgs-reset {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  padding: 2px 8px;
  cursor: pointer;
}

.pgs-order button:disabled {
  opacity: .4;
  cursor: default;
}

.pgs-remove {
  color: var(--dsw-alias-state-error-primary);
}

.pgs-upload-error {
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
}

.pgs-select {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  padding: 4px 8px;
}

.pgs-palette {
  border-collapse: collapse;
  width: 100%;
}

.pgs-palette th,
.pgs-palette td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  text-align: left;
  vertical-align: middle;
}

.pgs-palette th {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}

.pgs-token-name {
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.pgs-palette input[type='color'] {
  width: 28px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  vertical-align: middle;
}

.pgs-color-text {
  width: 190px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  padding: 2px 6px;
  margin-left: 6px;
}

@media (max-width: 599px) {
  .pgs-color-text {
    width: 120px;
  }
}

/* ── 0.4 visual settings console ───────────────────────────────────────── */
.pgs-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 3px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 76%, transparent);
}

.pgs-tabs button,
.pgs-theme-toggle button,
.pgs-mode-card,
.pgs-preset,
.pgs-preset-delete,
.pgs-button {
  border: 0;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  cursor: pointer;
}

.pgs-tabs button {
  min-height: 32px;
  border-radius: 10px;
  background: transparent;
  font-size: 12px;
}

.pgs-tabs button.is-active {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 3px 12px color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
}

.pgs-gallery-hero {
  position: relative;
  min-height: 118px;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent), color-mix(in srgb, var(--dsw-alias-bg-base) 40%, transparent)),
    var(--pgs-preview-image) center / cover;
  box-shadow: inset 0 1px color-mix(in srgb, white 18%, transparent);
}

.pgs-gallery-hero > div {
  position: absolute;
  left: 16px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pgs-gallery-hero span { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.pgs-gallery-hero strong { color: var(--dsw-alias-label-primary); font-size: 18px; letter-spacing: .02em; }

.pgs-mode-cards,
.pgs-quick-colors {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.pgs-mode-card {
  display: flex;
  min-height: 74px;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 11px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 72%, transparent);
  text-align: left;
}

.pgs-mode-card strong { color: var(--dsw-alias-label-primary); font-size: 13px; }
.pgs-mode-card span { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; }
.pgs-mode-card.is-active { border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, var(--dsw-alias-bg-layer-1)); }

.pgs-theme-toggle {
  display: inline-flex;
  align-self: flex-start;
  padding: 3px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
}

.pgs-theme-toggle button {
  padding: 5px 12px;
  border-radius: 999px;
  background: transparent;
  font-size: 12px;
}

.pgs-theme-toggle button.is-active { color: var(--dsw-alias-label-primary-foreground); background: var(--dsw-alias-brand-primary); }

.pgs-range-field,
.pgs-select-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}

.pgs-range-field b { color: var(--dsw-alias-label-primary); font-weight: 600; }
.pgs-range-field input { accent-color: var(--dsw-alias-brand-primary); }
.pgs-select-field .pgs-select { width: 100%; }

.pgs-card-list { gap: 7px; }
.pgs-card-list .pgs-image-item { cursor: grab; }
.pgs-card-list .pgs-image-item:active { cursor: grabbing; }

.pgs-dropzone {
  display: flex;
  min-height: 146px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px;
  border: 1px dashed var(--dsw-alias-border-l3);
  border-radius: 14px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 62%, transparent);
  text-align: center;
}

.pgs-dropzone.is-dragging { border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, var(--dsw-alias-bg-layer-1)); }
.pgs-dropzone strong { color: var(--dsw-alias-label-primary); font-size: 13px; }
.pgs-dropzone span { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.pgs-file-input { display: none; }

.pgs-button {
  padding: 6px 12px;
  border-radius: 8px;
  color: var(--dsw-alias-label-primary-foreground);
  background: var(--dsw-alias-brand-primary);
  font-size: 12px;
}

.pgs-button:disabled { cursor: default; opacity: .5; }
.pgs-upload-progress { position: relative; display: flex; width: min(260px, 100%); align-items: center; gap: 8px; }
.pgs-upload-progress::before { content: ''; flex: 1; height: 5px; overflow: hidden; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); }
.pgs-upload-progress i { position: absolute; top: 6px; left: 0; width: 0; height: 5px; border-radius: 999px; background: var(--dsw-alias-brand-primary); }

.pgs-quick-colors { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.pgs-quick-color { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 70%, transparent); }
.pgs-quick-color strong { color: var(--dsw-alias-label-primary); font-size: 13px; }
.pgs-quick-color label { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.pgs-quick-color input[type='color'] { width: 32px; height: 24px; padding: 0; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: none; }
.pgs-quick-color .pgs-range-field { align-items: stretch; }

.pgs-preset-strip,
.pgs-custom-presets,
.pgs-preset-save { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.pgs-preset-strip > span { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.pgs-preset,
.pgs-preset-delete { padding: 5px 9px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); font-size: 11px; }
.pgs-preset { border: 1px solid var(--dsw-alias-border-l2); }
.pgs-preset-delete { margin-left: -8px; color: var(--dsw-alias-state-error-primary); }
.pgs-preset-save input { min-width: 180px; flex: 1; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); padding: 6px 8px; font-size: 12px; }
.pgs-alpha-input { width: 74px; margin-left: 7px; accent-color: var(--dsw-alias-brand-primary); vertical-align: middle; }

/* ── Preset swatch cards ──────────────────────────────────────────────── */
.pgs-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}

.pgs-preset-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  text-align: center;
  cursor: pointer;
}

.pgs-preset-card:hover { border-color: var(--dsw-alias-brand-primary); }

.pgs-preset-swatch {
  height: 26px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: linear-gradient(90deg, var(--pgs-swatch-dark) 50%, var(--pgs-swatch-light) 50%);
}

.pgs-token-group-heading {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  margin: 10px 0 2px;
}

.pgs-action-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 66%, transparent); }
.pgs-action-card > div { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.pgs-action-card strong { color: var(--dsw-alias-label-primary); font-size: 13px; }
.pgs-action-card span { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 17px; }

/* Sidebar art is consolidated in the earlier block (::before = previous image,
   ::after = current image crossfade); no column background or lifting rule here. */

@media (max-width: 599px) {
  .pgs-mode-cards { grid-template-columns: 1fr; }
  .pgs-quick-colors { grid-template-columns: 1fr; }
  .pgs-tabs { gap: 1px; }
  .pgs-tabs button { font-size: 11px; }
  .pgs-action-card { align-items: flex-start; flex-direction: column; }
}

/* ── 0.4.1 layering fix ────────────────────────────────────────────────────
   The DSH settings modal (position: fixed; z-index: 1000) is rendered inside
   the sidebar column's DOM subtree (sidebar.settings slot). Isolating that
   column created a stacking context at z-auto, which trapped the modal below
   the conversation layer (composer, message bubbles, floating controls), so
   the settings page appeared behind the messages and could not be operated.

   Fix: stop isolating the sidebar column so the modal's z-index competes at
   the app-frame level again. The sidebar art no longer has the column's
   isolation to contain it, so pin both art pseudo-layers to the frame's
   negative layer (behind the sidebar text), and lower the opaque artboard one
   step so it cannot cover the sidebar art. */
[data-photowall-skin-frame] > div:first-child::before,
[data-photowall-skin-frame] > div:first-child::after {
  z-index: -1;
}

/* Pause the drifting wall while a modal dialog (the settings panel) is open,
   so the continuous transform + backdrop blur stop competing with the UI. */
[data-photowall-skin-frame]:has([role='dialog']) .pgs-track {
  animation-play-state: paused;
}

/* Composer seat input-mask: transparent seat (double attribute selector matches
   the shipped rule's specificity). The fade gradient lives on a frame-level
   pgs-composer-fade overlay (portaled outside the scroll container) so it
   can extend under the scrollbar — a pseudo-element on the seat would be
   clipped by the scroll container's overflow. 83% mix ≈ 70% opaque. */
[data-photowall-skin-frame] [data-composer-seat][data-composer-seat] {
  background: transparent;
}

.pgs-composer-fade {
  position: absolute;
  bottom: 0;
  z-index: 6;
  pointer-events: none;
  opacity: 0;
  transition: opacity 240ms ease;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--dsw-alias-bg-base) 0%, transparent) 0px,
    color-mix(in srgb, var(--dsw-alias-bg-base) 83%, transparent) 36px
  );
}

.pgs-composer-fade[data-visible] {
  opacity: 1;
}

/* Session header bar: slightly more opaque than the glass column so the gallery
   art doesn't show through the title strip as much. The header lives inside the
   conversation.session.header slot wrapper (display: contents), so target it
   via that slot rather than the [data-phase] root. */
[data-photowall-skin-frame] [data-slot='conversation.session.header'] > header {
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 84%, transparent);
}
`
