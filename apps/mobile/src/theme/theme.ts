import type { ColorSchemeName } from 'react-native'
import { darkColors, mistLightColors, motion, radii, sizes, spacing, typography } from './tokens'

export type AppTheme = {
  isDark: boolean
  colors: typeof mistLightColors | typeof darkColors
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
    // 浅色走雾蓝主题（V7），深色沿用既有 darkColors，待雾蓝深色板确认后再切。
    colors: isDark ? darkColors : mistLightColors,
    spacing,
    radii,
    typography,
    sizes,
    motion,
  }
}
