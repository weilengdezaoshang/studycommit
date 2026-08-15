import {
  darkColors,
  lightColors,
  motion,
  radii,
  sizes,
  spacing,
  typography,
} from '../src/theme/tokens'

describe('design tokens', () => {
  it('keeps the same complete semantic color contract in both themes', () => {
    const requiredColors = [
      'background',
      'surface',
      'surfaceMuted',
      'text',
      'textMuted',
      'textDisabled',
      'primary',
      'onPrimary',
      'primarySurface',
      'onPrimarySurface',
      'border',
      'borderStrong',
      'danger',
      'onDanger',
      'dangerSurface',
      'success',
      'successSurface',
      'warning',
      'warningSurface',
      'scrim',
    ]

    expect(Object.keys(lightColors).sort()).toEqual(requiredColors.sort())
    expect(Object.keys(darkColors).sort()).toEqual(requiredColors.sort())
  })

  it('uses valid hex colors without business-specific names', () => {
    const businessWords = /topic|note|review/i

    for (const colors of [lightColors, darkColors]) {
      for (const [name, value] of Object.entries(colors)) {
        expect(name).not.toMatch(businessWords)
        expect(value).toMatch(/^#[\dA-F]{6}([\dA-F]{2})?$/i)
      }
    }
  })

  it('defines a readable typography scale', () => {
    expect(Object.keys(typography)).toEqual([
      'display',
      'title',
      'heading',
      'subheading',
      'body',
      'bodySmall',
      'label',
      'caption',
    ])

    for (const textStyle of Object.values(typography)) {
      expect(textStyle.fontSize).toBeGreaterThan(0)
      expect(textStyle.lineHeight).toBeGreaterThanOrEqual(textStyle.fontSize)
    }

    for (const variant of [typography.body, typography.bodySmall]) {
      const ratio = variant.lineHeight / variant.fontSize
      expect(ratio).toBeGreaterThanOrEqual(1.4)
      expect(ratio).toBeLessThanOrEqual(1.75)
    }
  })

  it('uses a monotonic 4dp spacing rhythm', () => {
    const values = Object.values(spacing)

    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(values.every((value) => value >= 0 && value % 4 === 0)).toBe(true)
  })

  it('defines accessible control and icon sizes', () => {
    expect(sizes.touchTarget).toBeGreaterThanOrEqual(48)
    expect(sizes.controlHeight).toBeGreaterThanOrEqual(48)
    expect([sizes.iconSm, sizes.iconMd, sizes.iconLg, sizes.iconXl]).toEqual(
      [sizes.iconSm, sizes.iconMd, sizes.iconLg, sizes.iconXl].sort((a, b) => a - b),
    )
    expect(sizes.contentMaxWidth).toBeGreaterThanOrEqual(320)
  })

  it('defines valid radii and non-layout-shifting motion feedback', () => {
    expect(Object.values(radii).every((radius) => radius >= 0)).toBe(true)
    expect(radii.pill).toBeGreaterThan(radii.lg)
    expect(motion.disabledOpacity).toBeGreaterThan(0)
    expect(motion.pressedOpacity).toBeGreaterThan(motion.disabledOpacity)
    expect(motion.pressedOpacity).toBeLessThan(1)
    expect(motion.durationFast).toBeGreaterThanOrEqual(150)
    expect(motion.durationNormal).toBeGreaterThanOrEqual(motion.durationFast)
    expect(motion.durationNormal).toBeLessThanOrEqual(300)
  })
})
