import { StatusBar } from 'expo-status-bar'
import { AppNavigator } from '../navigation/AppNavigator'
import { useAppTheme } from '../theme/ThemeProvider'

export function AppShell() {
  const theme = useAppTheme()

  return (
    <>
      <AppNavigator />
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
    </>
  )
}
