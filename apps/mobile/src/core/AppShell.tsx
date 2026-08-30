import { StatusBar } from 'expo-status-bar'
import { AuthFlow } from '../features/auth/AuthFlow'
import { AppNavigator } from '../navigation/AppNavigator'
import { useAuthGate } from '../infrastructure/auth/session-store'
import { useAppTheme } from '../theme/ThemeProvider'

export function AppShell() {
  const theme = useAppTheme()
  const { hydrated, session } = useAuthGate()

  if (!hydrated) {
    // 会话恢复期间保持空白,避免登录页闪现
    return null
  }

  return (
    <>
      {session ? <AppNavigator /> : <AuthFlow />}
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
    </>
  )
}
