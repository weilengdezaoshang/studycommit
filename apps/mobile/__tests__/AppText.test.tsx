import { Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { AppText } from '../src/components/AppText'
import { ThemeProvider } from '../src/theme/ThemeProvider'
import { createTheme } from '../src/theme/theme'
import { typography } from '../src/theme/tokens'

function renderText(props: React.ComponentProps<typeof AppText> = {}, scheme: 'light' | 'dark' = 'light') {
  return render(
    <ThemeProvider colorScheme={scheme}>
      <AppText {...props}>测试文字</AppText>
    </ThemeProvider>,
  )
}

describe('<AppText />', () => {
  it('uses the body typography and default semantic color', async () => {
    await renderText()
    expect(screen.getByText('测试文字')).toHaveStyle({ ...typography.body, color: createTheme('light').colors.text })
  })

  it.each(Object.keys(typography) as Array<keyof typeof typography>)('maps the %s variant', async (variant) => {
    await renderText({ variant })
    expect(screen.getByText('测试文字')).toHaveStyle(typography[variant])
  })

  it.each([
    ['muted', 'textMuted'],
    ['danger', 'danger'],
    ['success', 'success'],
  ] as const)('maps %s to its semantic color', async (color, token) => {
    await renderText({ color })
    expect(screen.getByText('测试文字')).toHaveStyle({ color: createTheme('light').colors[token] })
  })

  it.each([
    ['regular', '400'],
    ['medium', '500'],
    ['semibold', '600'],
  ] as const)('maps %s weight', async (weight, fontWeight) => {
    await renderText({ weight })
    expect(screen.getByText('测试文字')).toHaveStyle({ fontWeight })
  })

  it.each(['title', 'heading'] as const)('gives %s a header role', async (variant) => {
    await renderText({ variant })
    expect(screen.getByRole('header', { name: '测试文字' })).toBeOnTheScreen()
  })

  it('does not give body text a header role', async () => {
    await renderText()
    expect(screen.queryByRole('header')).not.toBeOnTheScreen()
  })

  it('respects an explicit accessibility role', async () => {
    await renderText({ variant: 'heading', accessibilityRole: 'summary' })
    expect(screen.getByRole('summary')).toBeOnTheScreen()
  })

  it('forwards native props and merges caller styles', async () => {
    await renderText({ numberOfLines: 2, selectable: true, style: { marginTop: 12, textAlign: 'center' } })
    const text = screen.getByText('测试文字')
    expect(text.props.numberOfLines).toBe(2)
    expect(text.props.selectable).toBe(true)
    expect(text.props.allowFontScaling).not.toBe(false)
    expect(text).toHaveStyle({ marginTop: 12, textAlign: 'center', ...typography.body })
  })

  it('uses dark semantic colors and supports nested text', async () => {
    await render(
      <ThemeProvider colorScheme="dark">
        <AppText><Text>嵌套内容</Text></AppText>
      </ThemeProvider>,
    )
    expect(screen.getByText('嵌套内容')).toBeOnTheScreen()
  })
})
