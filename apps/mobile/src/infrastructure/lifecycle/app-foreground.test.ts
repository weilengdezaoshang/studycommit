import { AppState, type AppStateStatus } from 'react-native'
import { subscribeAppForeground } from './app-foreground'

describe('subscribeAppForeground', () => {
  it('notifies only when returning to the foreground and can be disposed', () => {
    const listeners = new Set<(state: AppStateStatus) => void>()
    const addEventListener = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event,
      listener,
    ) => {
      listeners.add(listener)
      return {
        remove: () => {
          listeners.delete(listener)
        },
      }
    }) as typeof AppState.addEventListener)
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' })

    const onForeground = jest.fn()
    const dispose = subscribeAppForeground(onForeground)
    listeners.forEach((listener) => listener('background'))
    expect(onForeground).not.toHaveBeenCalled()
    listeners.forEach((listener) => listener('active'))
    expect(onForeground).toHaveBeenCalledTimes(1)

    dispose()
    listeners.forEach((listener) => listener('background'))
    listeners.forEach((listener) => listener('active'))
    expect(onForeground).toHaveBeenCalledTimes(1)
    addEventListener.mockRestore()
  })
})
