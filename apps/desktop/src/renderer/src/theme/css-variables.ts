import {
  darkColors,
  mistLightColors,
  motion,
  radii,
  sizes,
  spacing,
  studyCommitMistBlueColors,
  typography,
  type SemanticColors,
} from '@studycommit/design-tokens'

export type ColorScheme = 'light' | 'dark'
export type CssVariables = Record<`--${string}`, string>
type StyleTarget = { setProperty(name: string, value: string): void }
type MediaQueryLike = {
  matches: boolean
  addEventListener(type: 'change', listener: () => void): void
  removeEventListener(type: 'change', listener: () => void): void
}

const kebabCase = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

function appendColors(variables: CssVariables, colors: SemanticColors) {
  for (const [name, value] of Object.entries(colors)) {
    variables[`--color-${kebabCase(name)}`] = value
  }
}

function appendPixels(
  variables: CssVariables,
  prefix: string,
  values: Readonly<Record<string, number>>,
) {
  for (const [name, value] of Object.entries(values)) {
    variables[`--${prefix}-${kebabCase(name)}`] = `${value}px`
  }
}

/**
 * V7 雾蓝纸面的短名变量(--ink/--paper 等):浅色直接取公共雾蓝色板,
 * 深色映射到深色语义色,两套键保持一致,V7 样式在两种配色下都有定义。
 */
function appendV7Palette(variables: CssVariables, colorScheme: ColorScheme) {
  const light = colorScheme === 'light'
  variables['--ink'] = light ? studyCommitMistBlueColors.ink : darkColors.text
  variables['--muted'] = light ? studyCommitMistBlueColors.muted : darkColors.textMuted
  variables['--muted-soft'] = light ? studyCommitMistBlueColors.mutedSoft : darkColors.textDisabled
  variables['--muted-faint'] = light
    ? studyCommitMistBlueColors.mutedFaint
    : darkColors.textDisabled
  variables['--paper'] = light ? studyCommitMistBlueColors.paper : darkColors.surface
  variables['--canvas'] = light ? studyCommitMistBlueColors.canvas : darkColors.background
  variables['--line'] = light ? studyCommitMistBlueColors.line : darkColors.border
  variables['--line-strong'] = light
    ? studyCommitMistBlueColors.lineStrong
    : darkColors.borderStrong
  variables['--accent'] = light ? studyCommitMistBlueColors.accent : darkColors.primarySurface
  variables['--action'] = light ? studyCommitMistBlueColors.action : darkColors.primary
  variables['--action-surface'] = light
    ? studyCommitMistBlueColors.actionSurface
    : darkColors.primarySurface
  variables['--action-surface-strong'] = light
    ? studyCommitMistBlueColors.actionSurfaceStrong
    : darkColors.primarySurface
  variables['--selected'] = light
    ? studyCommitMistBlueColors.selectedSurface
    : darkColors.primarySurface
  variables['--surface-soft'] = light
    ? studyCommitMistBlueColors.surfaceSoft
    : darkColors.surfaceMuted
  variables['--surface-warm'] = light
    ? studyCommitMistBlueColors.surfaceWarm
    : darkColors.surfaceMuted
  variables['--timeline'] = light ? studyCommitMistBlueColors.timeline : darkColors.borderStrong
  variables['--scrim'] = light ? studyCommitMistBlueColors.scrim : darkColors.scrim
}

export function createCssVariables(colorScheme: ColorScheme): CssVariables {
  const variables: CssVariables = {}
  // 浅色走雾蓝主题（V7），深色沿用既有 darkColors，待雾蓝深色板确认后再切。
  appendColors(variables, colorScheme === 'dark' ? darkColors : mistLightColors)
  appendV7Palette(variables, colorScheme)
  appendPixels(variables, 'space', spacing)
  appendPixels(variables, 'radius', radii)
  appendPixels(variables, 'size', sizes)
  for (const [name, style] of Object.entries(typography)) {
    variables[`--font-size-${kebabCase(name)}`] = `${style.fontSize}px`
    variables[`--line-height-${kebabCase(name)}`] = `${style.lineHeight}px`
  }
  variables['--motion-duration-fast'] = `${motion.durationFast}ms`
  variables['--motion-duration-normal'] = `${motion.durationNormal}ms`
  variables['--motion-disabled-opacity'] = String(motion.disabledOpacity)
  variables['--motion-pressed-opacity'] = String(motion.pressedOpacity)
  return variables
}

export function applyTheme(target: StyleTarget, colorScheme: ColorScheme) {
  for (const [name, value] of Object.entries(createCssVariables(colorScheme))) {
    target.setProperty(name, value)
  }
}

export function observeSystemTheme(target: StyleTarget, mediaQuery: MediaQueryLike) {
  const applyCurrentTheme = () => applyTheme(target, mediaQuery.matches ? 'dark' : 'light')
  applyCurrentTheme()
  mediaQuery.addEventListener('change', applyCurrentTheme)
  return () => mediaQuery.removeEventListener('change', applyCurrentTheme)
}
