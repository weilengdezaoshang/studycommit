import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native'

export function subscribeAppForeground(onForeground: () => void): () => void {
  let current: AppStateStatus = AppState.currentState
  const subscription: NativeEventSubscription = AppState.addEventListener(
    'change',
    (next: AppStateStatus) => {
      const wasBackground = current !== 'active'
      current = next
      if (wasBackground && next === 'active') {
        onForeground()
      }
    },
  )
  return () => {
    subscription.remove()
  }
}
