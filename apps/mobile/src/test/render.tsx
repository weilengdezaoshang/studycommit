import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react-native'
import {
  SafeAreaProvider,
  type Metrics,
} from 'react-native-safe-area-context'
import { ThemeProvider } from '../theme/ThemeProvider'

export const TEST_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

type RenderWithAppProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  colorScheme?: 'light' | 'dark'
  metrics?: Metrics
}

export function renderWithAppProviders(
  ui: ReactElement,
  {
    colorScheme = 'light',
    metrics = TEST_SAFE_AREA_METRICS,
    ...options
  }: RenderWithAppProvidersOptions = {},
) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider colorScheme={colorScheme}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
    options,
  )
}
