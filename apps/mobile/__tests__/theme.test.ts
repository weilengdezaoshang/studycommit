import { createElement } from 'react'
import { Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { ThemeProvider, useAppTheme } from '../src/theme/ThemeProvider'
import { createTheme } from '../src/theme/theme'
import { darkColors, lightColors, spacing } from '@studycommit/design-tokens'

describe('createTheme', () => {
  it('creates a light theme by default', () => {
    const theme = createTheme(undefined)

    expect(theme.isDark).toBe(false)
    expect(theme.colors.background).toBe(lightColors.background)
  })

  it('falls back to light for an absent system preference', () => {
    expect(createTheme(null).isDark).toBe(false)
    expect(createTheme(undefined).isDark).toBe(false)
  })

  it('creates a dark theme for the dark system preference', () => {
    const theme = createTheme('dark')

    expect(theme.isDark).toBe(true)
    expect(theme.colors.background).toBe(darkColors.background)
  })

  it('keeps the same semantic color contract in both themes', () => {
    const lightKeys = Object.keys(createTheme('light').colors).sort()
    const darkKeys = Object.keys(createTheme('dark').colors).sort()

    expect(darkKeys).toEqual(lightKeys)
  })

  it('uses the shared tokens as its single source of truth', () => {
    const theme = createTheme('light')

    expect(theme.colors).toBe(lightColors)
    expect(theme.spacing).toBe(spacing)
  })
})

function ThemeProbe() {
  const theme = useAppTheme()
  return createElement(Text, null, theme.isDark ? 'dark theme' : 'light theme')
}

describe('<ThemeProvider />', () => {
  it.each([
    ['light', 'light theme'],
    ['dark', 'dark theme'],
  ] as const)('supports an explicit %s override', async (colorScheme, expected) => {
    await render(
      createElement(
        ThemeProvider,
        { colorScheme },
        createElement(ThemeProbe),
      ),
    )

    expect(screen.getByText(expected)).toBeOnTheScreen()
  })

  it('fails clearly when the hook is used outside its provider', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await expect(render(createElement(ThemeProbe))).rejects.toThrow(
        'useAppTheme must be used within ThemeProvider',
      )
    } finally {
      consoleError.mockRestore()
    }
  })
})
