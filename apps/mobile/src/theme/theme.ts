import type { ColorSchemeName } from 'react-native'
import { darkColors, lightColors, radii, spacing, typography } from './tokens'

export type AppTheme = {
  isDark: boolean
  colors: typeof lightColors | typeof darkColors
  spacing: typeof spacing
  radii: typeof radii
  typography: typeof typography
}

export function createTheme(colorScheme: ColorSchemeName | null | undefined): AppTheme {
  const isDark = colorScheme === 'dark'

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    spacing,
    radii,
    typography,
  }
}
