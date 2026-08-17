import { initialWindowMetrics, type Metrics } from 'react-native-safe-area-context'

const EMPTY_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
}

export const appInitialWindowMetrics = initialWindowMetrics ?? EMPTY_SAFE_AREA_METRICS
