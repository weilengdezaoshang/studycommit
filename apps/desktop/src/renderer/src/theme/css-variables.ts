import {
  darkColors,
  lightColors,
  motion,
  radii,
  sizes,
  spacing,
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

export function createCssVariables(colorScheme: ColorScheme): CssVariables {
  const variables: CssVariables = {}
  appendColors(variables, colorScheme === 'dark' ? darkColors : lightColors)
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
