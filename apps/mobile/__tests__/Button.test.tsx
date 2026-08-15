import { render, screen, userEvent } from '@testing-library/react-native'
import { Button } from '../src/components/Button'
import { ThemeProvider } from '../src/theme/ThemeProvider'
import { createTheme } from '../src/theme/theme'
import { motion, sizes } from '../src/theme/tokens'

function renderButton(props: Partial<React.ComponentProps<typeof Button>> = {}, scheme: 'light' | 'dark' = 'light') {
  return render(
    <ThemeProvider colorScheme={scheme}>
      <Button onPress={jest.fn()} {...props}>创建专题</Button>
    </ThemeProvider>,
  )
}

describe('<Button />', () => {
  it('renders an accessible button and handles a press', async () => {
    const onPress = jest.fn()
    await renderButton({ onPress })
    await userEvent.setup().press(screen.getByRole('button', { name: '创建专题' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['disabled', { disabled: true }],
    ['loading', { loading: true }],
  ] as const)('blocks presses while %s', async (_state, props) => {
    const onPress = jest.fn()
    await renderButton({ ...props, onPress })
    const button = screen.getByRole('button', { name: '创建专题' })
    await userEvent.setup().press(button)
    expect(onPress).not.toHaveBeenCalled()
    expect(button.props.accessibilityState.disabled).toBe(true)
  })

  it('exposes busy state and a progress indicator while loading', async () => {
    await renderButton({ loading: true })
    expect(screen.getByRole('button', { name: '创建专题' }).props.accessibilityState).toEqual({ disabled: true, busy: true })
    expect(screen.getByTestId('button-loading-indicator')).toBeOnTheScreen()
  })

  it.each([
    ['primary', 'primary', 'onPrimary'],
    ['secondary', 'surface', 'text'],
    ['danger', 'danger', 'onDanger'],
  ] as const)('styles the %s variant semantically', async (variant, background, foreground) => {
    const theme = createTheme('light')
    await renderButton({ variant })
    expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: theme.colors[background] })
    expect(screen.getByText('创建专题')).toHaveStyle({ color: theme.colors[foreground] })
  })

  it('styles the ghost variant without an opaque background', async () => {
    await renderButton({ variant: 'ghost' })
    expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: 'transparent' })
    expect(screen.getByText('创建专题')).toHaveStyle({ color: createTheme('light').colors.primary })
  })

  it('uses theme values in dark mode', async () => {
    await renderButton({}, 'dark')
    expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: createTheme('dark').colors.primary })
  })

  it.each([
    ['medium', sizes.controlHeight],
    ['large', 56],
  ] as const)('provides an accessible %s control size', async (size, minHeight) => {
    await renderButton({ size })
    expect(screen.getByRole('button')).toHaveStyle({ minHeight })
  })

  it('uses token opacity for disabled state', async () => {
    await renderButton({ disabled: true })
    expect(screen.getByRole('button')).toHaveStyle({ opacity: motion.disabledOpacity })
  })

  it('forwards native props and caller layout styles', async () => {
    const onLongPress = jest.fn()
    await renderButton({ accessibilityHint: '新建知识专题', onLongPress, testID: 'create', style: { marginTop: 12 } })
    const button = screen.getByTestId('create')
    expect(button.props.accessibilityHint).toBe('新建知识专题')
    expect(button).toHaveStyle({ minHeight: sizes.controlHeight, marginTop: 12 })
    await userEvent.setup().longPress(button)
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })
})
