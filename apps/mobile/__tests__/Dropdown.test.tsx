import { useState } from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { Dropdown } from '../src/components/Dropdown'
import { ThemeProvider } from '../src/theme/ThemeProvider'

function Host() {
  const [value, setValue] = useState('')
  return (
    <Dropdown
      label="专题"
      onChange={setValue}
      options={[
        { label: 'Electron 架构', value: 'topic-1' },
        { label: 'React Native', value: 'topic-2' },
      ]}
      placeholder="请选择专题"
      value={value}
    />
  )
}

describe('Dropdown', () => {
  it('stays closed until opened and only then lets the user pick a value', async () => {
    const user = userEvent.setup()
    await render(
      <ThemeProvider colorScheme="light">
        <Host />
      </ThemeProvider>,
    )
    expect(screen.getByLabelText('专题')).toBeOnTheScreen()
    expect(screen.getByText('请选择专题')).toBeOnTheScreen()
    expect(screen.queryByRole('menuitem', { name: 'Electron 架构' })).not.toBeOnTheScreen()

    await user.press(screen.getByLabelText('专题'))
    expect(screen.getByRole('menuitem', { name: 'Electron 架构' })).toBeOnTheScreen()
    expect(screen.getByText('请选择专题')).toBeOnTheScreen()
    await user.press(screen.getByRole('menuitem', { name: 'Electron 架构' }))
    expect(screen.getByText('Electron 架构')).toBeOnTheScreen()
    expect(screen.queryByRole('menuitem', { name: 'React Native' })).not.toBeOnTheScreen()
  })
})
