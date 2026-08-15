import { render, screen, userEvent } from '@testing-library/react-native'
import { Button } from '../src/components/Button'
import { EmptyState } from '../src/components/EmptyState'
import { ErrorState } from '../src/components/ErrorState'
import { LoadingState } from '../src/components/LoadingState'
import { OfflineBanner } from '../src/components/OfflineBanner'
import { ThemeProvider } from '../src/theme/ThemeProvider'

const wrap = (child: React.ReactNode) => render(<ThemeProvider colorScheme="light">{child}</ThemeProvider>)

describe('status patterns', () => {
  it('exposes a labelled busy loading state', async () => {
    await wrap(<LoadingState label="正在加载专题" />)
    expect(screen.getByText('正在加载专题')).toBeOnTheScreen()
    expect(screen.getByLabelText('正在加载专题').props.accessibilityState.busy).toBe(true)
  })

  it('renders and invokes an empty-state action', async () => {
    const onAction = jest.fn()
    await wrap(<EmptyState actionLabel="创建专题" description="创建后即可开始学习" onAction={onAction} title="还没有专题" />)
    await userEvent.setup().press(screen.getByRole('button', { name: '创建专题' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('announces errors and blocks retry while retrying', async () => {
    const onRetry = jest.fn()
    await wrap(<ErrorState description="请检查网络" onRetry={onRetry} retrying title="加载失败" />)
    expect(screen.getByRole('alert')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: '重试' }))
    expect(onRetry).not.toHaveBeenCalled()
  })

  it.each([[0, '离线可继续使用'], [1, '1 条内容待同步'], [3, '3 条内容待同步'], [-1, '离线可继续使用']] as const)('formats pending count %s', async (count, text) => {
    await wrap(<OfflineBanner pendingCount={count} />)
    expect(screen.getByText(text)).toBeOnTheScreen()
  })

  it('does not block surrounding actions', async () => {
    const onPress = jest.fn()
    await wrap(<><OfflineBanner /><Button onPress={onPress}>继续学习</Button></>)
    await userEvent.setup().press(screen.getByRole('button', { name: '继续学习' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
