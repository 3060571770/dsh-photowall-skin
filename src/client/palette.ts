import type { PaletteColor, PaletteCustomization, ThemePair } from '../settings.ts'
import { TOKENS } from './tokens.ts'

export interface BuiltinPalettePreset {
  id: string
  name: string
  quick: ThemePair<{ seedColor: string; opacity: number }>
}

function hex(value: string): [number, number, number] {
  const normalized = /^#([0-9a-f]{6})$/i.exec(value)?.[1] ?? '888888'
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ]
}

function blend(from: string, to: string, weight: number): string {
  const source = hex(from)
  const target = hex(to)
  const channel = (index: number): number => Math.round(source[index]! * (1 - weight) + target[index]! * weight)
  return `#${channel(0).toString(16).padStart(2, '0')}${channel(1).toString(16).padStart(2, '0')}${channel(2).toString(16).padStart(2, '0')}`
}

function rgba(color: string, alpha: number): string {
  const [r, g, b] = hex(color)
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`
}

function themeTokens(seed: string, opacity: number, scheme: 'dark' | 'light'): Record<string, string> {
  const dark = scheme === 'dark'
  const canvas = dark ? '#1d1412' : '#fff7f4'
  const paper = dark ? '#38241f' : '#faebe6'
  const ink = dark ? '#fff0e5' : '#2b292c'
  const secondary = dark ? '#dcc5b3' : '#625a58'
  const muted = dark ? '#ab9a8f' : '#817a78'
  const accent = blend(seed, dark ? '#f1b69a' : '#7b3027', dark ? 0.2 : 0.18)
  const brandText = blend(seed, ink, dark ? 0.52 : 0.34)
  const layers = [0.78, 0.9, 0.96, 0.98, 0.98].map(multiplier => Math.min(1, opacity * multiplier))
  return {
    '--dsw-alias-bg-base': rgba(blend(canvas, seed, dark ? 0.15 : 0.08), layers[0]!),
    '--dsw-alias-bg-layer-1': rgba(blend(paper, seed, dark ? 0.16 : 0.09), layers[1]!),
    '--dsw-alias-bg-layer-2': rgba(blend(paper, seed, dark ? 0.28 : 0.18), layers[2]!),
    '--dsw-alias-bg-layer-3': rgba(blend(paper, seed, dark ? 0.12 : 0.06), layers[3]!),
    '--dsw-alias-bg-overlay': rgba(blend(paper, seed, dark ? 0.12 : 0.06), layers[4]!),
    '--dsw-alias-border-l1': rgba(ink, opacity * 0.1),
    '--dsw-alias-border-l2': rgba(ink, opacity * 0.18),
    '--dsw-alias-border-l3': rgba(ink, opacity * 0.28),
    '--dsw-alias-brand-primary': accent,
    '--dsw-alias-brand-text': brandText,
    '--dsw-alias-button-primary-hover': blend(accent, ink, dark ? 0.1 : 0.18),
    '--dsw-alias-label-primary': ink,
    '--dsw-alias-label-secondary': secondary,
    '--dsw-alias-label-tertiary': muted,
    '--dsw-alias-label-primary-foreground': dark ? '#35211c' : '#fff8f5',
    '--dsw-specific-sidebar-fill': rgba(blend(paper, seed, dark ? 0.16 : 0.1), opacity * 0.82),
    '--dsw-specific-bubble': rgba(blend(paper, seed, dark ? 0.12 : 0.07), opacity * 0.7),
  }
}

/** Generate all skin tokens from one independent seed/opacity pair per theme. */
export function generateQuickTokens(quick: PaletteCustomization['quick']): Record<string, PaletteColor> {
  const dark = themeTokens(quick.dark.seedColor, quick.dark.opacity, 'dark')
  const light = themeTokens(quick.light.seedColor, quick.light.opacity, 'light')
  const generated: Record<string, PaletteColor> = {}
  for (const name of Object.keys(TOKENS)) {
    generated[name] = { light: light[name]!, dark: dark[name]! }
  }
  return generated
}

export const BUILTIN_PALETTE_PRESETS: readonly BuiltinPalettePreset[] = [
  { id: 'original', name: '原始暖棕', quick: { dark: { seedColor: '#D7967B', opacity: 0.76 }, light: { seedColor: '#9F4C3E', opacity: 0.76 } } },
  { id: 'neutral', name: '中性灰', quick: { dark: { seedColor: '#9ba0a8', opacity: 0.74 }, light: { seedColor: '#68717d', opacity: 0.76 } } },
  { id: 'blue', name: '静谧蓝', quick: { dark: { seedColor: '#8fb8df', opacity: 0.76 }, light: { seedColor: '#356f9f', opacity: 0.78 } } },
  { id: 'forest', name: '森林绿', quick: { dark: { seedColor: '#9fcaad', opacity: 0.76 }, light: { seedColor: '#3f7654', opacity: 0.78 } } },
]

export function builtinTokens(id: string, quick: PaletteCustomization['quick']): Record<string, PaletteColor> {
  return id === 'original' ? { ...TOKENS } : generateQuickTokens(quick)
}
