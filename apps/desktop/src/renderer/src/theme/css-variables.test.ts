import { describe, expect, it, vi } from 'vitest'
import {
  darkColors,
  lightColors,
  motion,
  radii,
  spacing,
  typography,
} from '@studycommit/design-tokens'
import { createCssVariables, observeSystemTheme } from './css-variables'

describe('desktop CSS variable adapter', () => {
  it('maps shared light tokens to stable CSS variable names and units', () => {
    const variables = createCssVariables('light')

    expect(variables['--color-primary']).toBe(lightColors.primary)
    expect(variables['--space-md']).toBe(`${spacing.md}px`)
    expect(variables['--radius-md']).toBe(`${radii.md}px`)
    expect(variables['--font-size-body']).toBe(`${typography.body.fontSize}px`)
    expect(variables['--motion-duration-fast']).toBe(`${motion.durationFast}ms`)
    expect(variables['--motion-disabled-opacity']).toBe(String(motion.disabledOpacity))
  })

  it('keeps light and dark variable keys aligned', () => {
    expect(Object.keys(createCssVariables('dark')).sort()).toEqual(
      Object.keys(createCssVariables('light')).sort(),
    )
    expect(createCssVariables('dark')['--color-primary']).toBe(darkColors.primary)
  })

  it('applies the current system theme and reacts to changes', () => {
    const setProperty = vi.fn()
    let changeListener: (() => void) | undefined
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        changeListener = listener
      }),
      removeEventListener: vi.fn(),
    }

    const dispose = observeSystemTheme({ setProperty }, mediaQuery)
    expect(setProperty).toHaveBeenCalledWith('--color-primary', lightColors.primary)

    mediaQuery.matches = true
    changeListener?.()
    expect(setProperty).toHaveBeenLastCalledWith(
      '--motion-pressed-opacity',
      String(motion.pressedOpacity),
    )
    expect(setProperty).toHaveBeenCalledWith('--color-primary', darkColors.primary)

    dispose()
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
