import type { PropsWithChildren } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider } from '../theme/ThemeProvider'
import { appInitialWindowMetrics } from './safeArea'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={appInitialWindowMetrics}>
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  )
}
