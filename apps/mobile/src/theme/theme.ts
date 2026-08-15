import type { ColorSchemeName } from 'react-native'
import {
  darkColors,
  lightColors,
  motion,
  radii,
  sizes,
  spacing,
  typography,
} from './tokens'

export type AppTheme = {
  isDark: boolean
  colors: typeof lightColors | typeof darkColors
  spacing: typeof spacing
  radii: typeof radii
  typography: typeof typography
  sizes: typeof sizes
  motion: typeof motion
}

export function createTheme(colorScheme: ColorSchemeName | null | undefined): AppTheme {
  const isDark = colorScheme === 'dark'

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    spacing,
    radii,
    typography,
    sizes,
    motion,
  }
}
