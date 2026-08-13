import { createContext, type PropsWithChildren, useContext, useMemo } from 'react'
import { type ColorSchemeName, useColorScheme } from 'react-native'
import { createTheme, type AppTheme } from './theme'

const ThemeContext = createContext<AppTheme | null>(null)

type ThemeProviderProps = PropsWithChildren<{
  colorScheme?: ColorSchemeName
}>

export function ThemeProvider({ children, colorScheme }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme()
  const theme = useMemo(
    () => createTheme(colorScheme ?? systemColorScheme),
    [colorScheme, systemColorScheme],
  )

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useAppTheme(): AppTheme {
  const theme = useContext(ThemeContext)

  if (!theme) {
    throw new Error('useAppTheme must be used within ThemeProvider')
  }

  return theme
}
