import { Text } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { AppErrorBoundary } from '../src/components/AppErrorBoundary'

describe('<AppErrorBoundary />', () => {
  it('renders healthy children unchanged', async () => {
    await render(
      <AppErrorBoundary>
        <Text>正常内容</Text>
      </AppErrorBoundary>,
    )

    expect(screen.getByText('正常内容')).toBeOnTheScreen()
  })

  it('shows an accessible fallback and retries rendering', async () => {
    let shouldThrow = true
    const onError = jest.fn()
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    function FlakyContent() {
      if (shouldThrow) {
        throw new Error('expected test error')
      }
      return <Text>恢复成功</Text>
    }

    try {
      await render(
        <AppErrorBoundary onError={onError}>
          <FlakyContent />
        </AppErrorBoundary>,
      )

      expect(screen.getByRole('alert')).toBeOnTheScreen()
      expect(screen.getByText('应用暂时无法显示')).toBeOnTheScreen()
      expect(onError).toHaveBeenCalledTimes(1)

      shouldThrow = false
      const user = userEvent.setup()
      await user.press(screen.getByRole('button', { name: '重试' }))

      expect(screen.getByText('恢复成功')).toBeOnTheScreen()
    } finally {
      consoleError.mockRestore()
    }
  })
})
