import { createNavigationTheme } from '../src/navigation/navigation.theme'
import { createTheme } from '../src/theme/theme'

describe('createNavigationTheme', () => {
  it('maps semantic app colors into a light navigation theme', () => {
    const appTheme = createTheme('light')
    const navigationTheme = createNavigationTheme(appTheme)

    expect(navigationTheme.dark).toBe(false)
    expect(navigationTheme.colors.background).toBe(appTheme.colors.background)
    expect(navigationTheme.colors.primary).toBe(appTheme.colors.primary)
  })

  it('maps semantic app colors into a dark navigation theme', () => {
    const appTheme = createTheme('dark')
    const navigationTheme = createNavigationTheme(appTheme)

    expect(navigationTheme.dark).toBe(true)
    expect(navigationTheme.colors.card).toBe(appTheme.colors.surface)
    expect(navigationTheme.colors.text).toBe(appTheme.colors.text)
  })
})
