import { StatusBar } from 'expo-status-bar'
import { AuthFlow } from '../features/auth/AuthFlow'
import { AppNavigator } from '../navigation/AppNavigator'
import { useAuthGate } from '../infrastructure/auth/session-store'
import { useAppTheme } from '../theme/ThemeProvider'
import { useMobileServices } from './MobileServicesProvider'
import { configurePapersServices, loadRemote } from '../features/papers/papers-store'
import { useEffect } from 'react'

export function AppShell() {
  const theme = useAppTheme()
  const { hydrated, session } = useAuthGate()
  const services = useMobileServices()

  useEffect(() => {
    configurePapersServices(services)
    if (session) {
      void loadRemote()
    }
  }, [services, session])

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
