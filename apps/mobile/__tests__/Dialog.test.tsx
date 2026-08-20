import { useState } from 'react'
import { Pressable, Text } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { useDialog } from '../src/components/dialog/useDialog'
import { ThemeProvider } from '../src/theme/ThemeProvider'

function Host() {
  const dialog = useDialog()
  const [done, setDone] = useState(false)
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          dialog.show({
            title: '结束本次学习？',
            description: '完成后计时将停止，本阶段不会自动生成学习记录。',
            cancelLabel: '继续学习',
            confirmLabel: '确认完成',
            onConfirm: () => {
              setDone(true)
            },
          })
        }
      >
        <Text>打开</Text>
      </Pressable>
      {done ? <Text>已确认</Text> : null}
      {dialog.dialog}
    </>
  )
}

function DateTimeHost() {
  const dialog = useDialog()
  const [done, setDone] = useState(false)
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          dialog.show({
            title: '修正结束时间',
            field: {
              label: '结束时间',
              type: 'datetime-local',
              defaultValue: '',
              min: '2026-08-17T08:10',
              required: true,
            },
            confirmLabel: '确认结束',
            onConfirm: () => {
              setDone(true)
            },
          })
        }
      >
        <Text>打开时间</Text>
      </Pressable>
      {done ? <Text>已确认结束</Text> : null}
      {dialog.dialog}
    </>
  )
}

describe('useDialog', () => {
  it('shows hook text and confirms', async () => {
    const user = userEvent.setup()
    await render(
      <ThemeProvider colorScheme="light">
        <Host />
      </ThemeProvider>,
    )
    await user.press(screen.getByRole('button', { name: '打开' }))
    expect(screen.getByLabelText('结束本次学习？')).toBeOnTheScreen()
    expect(screen.getByText('完成后计时将停止，本阶段不会自动生成学习记录。')).toBeOnTheScreen()
    await user.press(screen.getByRole('button', { name: '确认完成' }))
    expect(await screen.findByText('已确认')).toBeOnTheScreen()
  })

  it('keeps the dialog open and shows the error when confirm fails', async () => {
    function FailHost() {
      const dialog = useDialog()
      return (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              dialog.show({
                title: '结束本次学习？',
                confirmLabel: '确认完成',
                onConfirm: async () => {
                  throw new Error('服务返回了无法识别的数据。')
                },
              })
            }
          >
            <Text>打开失败</Text>
          </Pressable>
          {dialog.dialog}
        </>
      )
    }
    const user = userEvent.setup()
    await render(
      <ThemeProvider colorScheme="light">
        <FailHost />
      </ThemeProvider>,
    )
    await user.press(screen.getByRole('button', { name: '打开失败' }))
    await user.press(screen.getByRole('button', { name: '确认完成' }))
    expect(screen.getByLabelText('结束本次学习？')).toBeOnTheScreen()
    expect(await screen.findByText('服务返回了无法识别的数据。')).toBeOnTheScreen()
  })

  it('keeps the dialog open when the datetime field is invalid', async () => {
    const user = userEvent.setup()
    await render(
      <ThemeProvider colorScheme="light">
        <DateTimeHost />
      </ThemeProvider>,
    )
    await user.press(screen.getByRole('button', { name: '打开时间' }))
    await user.press(screen.getByRole('button', { name: '确认结束' }))
    expect(screen.getByLabelText('修正结束时间')).toBeOnTheScreen()
    expect(screen.getByText('请填写结束时间')).toBeOnTheScreen()
    expect(screen.queryByText('已确认结束')).not.toBeOnTheScreen()
  })
})
