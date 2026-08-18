import type { PropsWithChildren } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import type { MobileServices } from '../infrastructure/http/create-mobile-services'
import { ThemeProvider } from '../theme/ThemeProvider'
import { MobileServicesProvider } from './MobileServicesProvider'
import { appInitialWindowMetrics } from './safeArea'

export function AppProviders({
  children,
  services,
}: PropsWithChildren<{ services?: MobileServices }>) {
  return (
    <SafeAreaProvider initialMetrics={appInitialWindowMetrics}>
      <ThemeProvider>
        <MobileServicesProvider services={services}>{children}</MobileServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
