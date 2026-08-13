import { createTheme } from '../src/theme/theme'

describe('createTheme', () => {
  it('creates a light theme by default', () => {
    const theme = createTheme(undefined)

    expect(theme.isDark).toBe(false)
    expect(theme.colors.background).toBe('#F3F7F7')
  })

  it('creates a dark theme for the dark system preference', () => {
    const theme = createTheme('dark')

    expect(theme.isDark).toBe(true)
    expect(theme.colors.background).toBe('#121A1C')
  })

  it('keeps the same semantic color contract in both themes', () => {
    const lightKeys = Object.keys(createTheme('light').colors).sort()
    const darkKeys = Object.keys(createTheme('dark').colors).sort()

    expect(darkKeys).toEqual(lightKeys)
  })
})
