import { render, screen, userEvent } from '@testing-library/react-native'
import { useState } from 'react'
import { Text } from 'react-native'
import { Card } from '../src/components/Card'
import { IconButton } from '../src/components/IconButton'
import { TextField } from '../src/components/TextField'
import { ThemeProvider } from '../src/theme/ThemeProvider'

const wrap = (child: React.ReactNode) => render(<ThemeProvider colorScheme="light">{child}</ThemeProvider>)

describe('design-system primitives', () => {
  it('renders a named 48dp icon button and handles presses', async () => {
    const onPress = jest.fn()
    await wrap(<IconButton accessibilityLabel="搜索专题" icon="search-outline" onPress={onPress} />)
    const button = screen.getByRole('button', { name: '搜索专题' })
    expect(button).toHaveStyle({ minHeight: 48, minWidth: 48 })
    await userEvent.setup().press(button)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('blocks a disabled icon button', async () => {
    const onPress = jest.fn()
    await wrap(<IconButton accessibilityLabel="删除" disabled icon="trash-outline" onPress={onPress} variant="danger" />)
    const button = screen.getByRole('button', { name: '删除' })
    await userEvent.setup().press(button)
    expect(onPress).not.toHaveBeenCalled()
    expect(button.props.accessibilityState.disabled).toBe(true)
  })

  it('keeps a static Card non-interactive', async () => {
    await wrap(<Card><Text>卡片内容</Text></Card>)
    expect(screen.getByText('卡片内容')).toBeOnTheScreen()
    expect(screen.queryByRole('button')).not.toBeOnTheScreen()
  })

  it('makes an explicitly named Card interactive', async () => {
    const onPress = jest.fn()
    await wrap(<Card accessibilityLabel="打开专题" onPress={onPress}><Text>React Native</Text></Card>)
    await userEvent.setup().press(screen.getByRole('button', { name: '打开专题' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('labels a TextField and forwards text changes', async () => {
    function ControlledField() {
      const [value, setValue] = useState('')
      return <TextField label="专题名称" onChangeText={setValue} value={value} />
    }
    await wrap(<ControlledField />)
    await userEvent.setup().type(screen.getByLabelText('专题名称'), 'React')
    expect(screen.getByLabelText('专题名称').props.value).toBe('React')
  })

  it('shows error instead of helper and marks input invalid', async () => {
    await wrap(<TextField error="专题名称不能为空" helperText="最多 40 字" label="专题名称" value="" />)
    expect(screen.getByRole('alert')).toHaveTextContent('专题名称不能为空')
    expect(screen.queryByText('最多 40 字')).not.toBeOnTheScreen()
    expect(screen.getByLabelText('专题名称').props.accessibilityHint).toBe('专题名称不能为空')
  })

  it('keeps multiline and native input props', async () => {
    await wrap(<TextField autoCapitalize="none" keyboardType="email-address" label="说明" multiline value="" />)
    const input = screen.getByLabelText('说明')
    expect(input).toHaveStyle({ minHeight: 96 })
    expect(input.props.keyboardType).toBe('email-address')
  })
})
