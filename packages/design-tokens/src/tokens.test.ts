import { describe, expect, it } from 'vitest'
import { darkColors, lightColors, motion, radii, sizes, spacing, typography } from './index'

describe('cross-platform design tokens', () => {
  it('keeps the same semantic color contract in light and dark themes', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort())
  })

  it('uses portable hexadecimal color values', () => {
    for (const value of [...Object.values(lightColors), ...Object.values(darkColors)]) {
      expect(value).toMatch(/^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/i)
    }
  })

  it('exports valid shared numeric scales', () => {
    expect(Object.values(spacing).every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
    expect(Object.values(radii).every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
    expect(Object.values(sizes).every((value) => Number.isFinite(value) && value > 0)).toBe(true)
    expect(motion.durationFast).toBeLessThanOrEqual(motion.durationNormal)

    for (const style of Object.values(typography)) {
      expect(style.fontSize).toBeGreaterThan(0)
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize)
    }
  })

  it('preserves the established mobile-compatible scale', () => {
    expect(spacing.md).toBe(16)
    expect(radii.md).toBe(12)
    expect(sizes.iconMd).toBe(20)
    expect(lightColors.primary).toBe('#0F766E')
    expect(darkColors.primary).toBe('#72CEC5')
  })
})
