/** Skin palette tokens: the skin's theme-token overrides, editable in the
 * settings page. Each entry is a `{ light, dark }` CSS color pair. */
export const TOKENS: Record<string, { light: string; dark: string }> = {
  '--dsw-alias-bg-base': { light: 'rgba(249, 234, 229, 0.82)', dark: 'rgba(35, 22, 18, 0.84)' },
  '--dsw-alias-bg-layer-1': { light: 'rgba(249, 234, 229, 0.94)', dark: 'rgba(62, 39, 34, 0.94)' },
  '--dsw-alias-bg-layer-2': { light: 'rgba(214, 208, 206, 0.96)', dark: 'rgba(95, 79, 73, 0.96)' },
  '--dsw-alias-bg-layer-3': { light: 'rgba(249, 234, 229, 0.98)', dark: 'rgba(62, 39, 34, 0.98)' },
  '--dsw-alias-bg-overlay': { light: 'rgba(249, 234, 229, 0.98)', dark: 'rgba(62, 39, 34, 0.98)' },
  '--dsw-alias-border-l1': { light: 'rgba(53, 54, 58, 0.10)', dark: 'rgba(247, 217, 195, 0.10)' },
  '--dsw-alias-border-l2': { light: 'rgba(53, 54, 58, 0.18)', dark: 'rgba(247, 217, 195, 0.18)' },
  '--dsw-alias-border-l3': { light: 'rgba(53, 54, 58, 0.28)', dark: 'rgba(247, 217, 195, 0.28)' },
  '--dsw-alias-brand-primary': { light: '#9F4C3E', dark: '#D7967B' },
  '--dsw-alias-brand-text': { light: '#7E382F', dark: '#F7D9C3' },
  '--dsw-alias-button-primary-hover': { light: '#853E34', dark: '#E5AB92' },
  '--dsw-alias-label-primary': { light: '#35363A', dark: '#F7D9C3' },
  '--dsw-alias-label-secondary': { light: '#5F5552', dark: '#D3B9A3' },
  '--dsw-alias-label-tertiary': { light: '#787A7D', dark: '#A39586' },
  '--dsw-alias-label-primary-foreground': { light: '#F9EAE5', dark: '#3E2722' },
  '--dsw-specific-sidebar-fill': { light: 'rgba(249, 234, 229, 0.76)', dark: 'rgba(62, 39, 34, 0.78)' },
  '--dsw-specific-bubble': { light: 'rgba(249, 234, 229, 0.62)', dark: 'rgba(62, 39, 34, 0.66)' },
}

/** Token → settings-page locale key (human-readable color names). */
export const TOKEN_LABEL_KEYS: Record<string, string> = {
  '--dsw-alias-bg-base': 'token.bg-base',
  '--dsw-alias-bg-layer-1': 'token.bg-layer-1',
  '--dsw-alias-bg-layer-2': 'token.bg-layer-2',
  '--dsw-alias-bg-layer-3': 'token.bg-layer-3',
  '--dsw-alias-bg-overlay': 'token.bg-overlay',
  '--dsw-alias-border-l1': 'token.border-l1',
  '--dsw-alias-border-l2': 'token.border-l2',
  '--dsw-alias-border-l3': 'token.border-l3',
  '--dsw-alias-brand-primary': 'token.brand-primary',
  '--dsw-alias-brand-text': 'token.brand-text',
  '--dsw-alias-button-primary-hover': 'token.button-primary-hover',
  '--dsw-alias-label-primary': 'token.label-primary',
  '--dsw-alias-label-secondary': 'token.label-secondary',
  '--dsw-alias-label-tertiary': 'token.label-tertiary',
  '--dsw-alias-label-primary-foreground': 'token.label-primary-foreground',
  '--dsw-specific-sidebar-fill': 'token.sidebar-fill',
  '--dsw-specific-bubble': 'token.bubble',
}

/** High-frequency tokens shown outside the advanced expander. */
export const COMMON_TOKENS: readonly string[] = [
  '--dsw-alias-brand-primary',
  '--dsw-alias-bg-base',
  '--dsw-specific-bubble',
  '--dsw-alias-label-primary',
]

/** Semantic groups for the remaining tokens (shown behind the advanced expander). */
export interface TokenGroup {
  key: string
  /** Locale key for the group heading. */
  label: string
  tokens: readonly string[]
}

export const TOKEN_GROUPS: readonly TokenGroup[] = [
  { key: 'background', label: 'palette.group-background', tokens: [
    '--dsw-alias-bg-layer-1',
    '--dsw-alias-bg-layer-2',
    '--dsw-alias-bg-layer-3',
    '--dsw-alias-bg-overlay',
    '--dsw-specific-sidebar-fill',
  ] },
  { key: 'border', label: 'palette.group-border', tokens: [
    '--dsw-alias-border-l1',
    '--dsw-alias-border-l2',
    '--dsw-alias-border-l3',
  ] },
  { key: 'brand', label: 'palette.group-brand', tokens: [
    '--dsw-alias-brand-text',
    '--dsw-alias-button-primary-hover',
  ] },
  { key: 'label', label: 'palette.group-label', tokens: [
    '--dsw-alias-label-secondary',
    '--dsw-alias-label-tertiary',
    '--dsw-alias-label-primary-foreground',
  ] },
]
