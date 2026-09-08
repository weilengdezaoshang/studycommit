import { describe, expect, it } from 'vitest'
import {
  darkColors,
  lightColors,
  mistLightColors,
  motion,
  radii,
  sizes,
  spacing,
  studyCommitMistBlueColors,
  typography,
} from './index'

describe('cross-platform design tokens', () => {
  it('keeps the same semantic color contract in light and dark themes', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort())
  })

  it('保持雾蓝语义浅色板与既有语义色板同键同状态色', () => {
    expect(Object.keys(mistLightColors).sort()).toEqual(Object.keys(lightColors).sort())
    // 品牌与中性色切换雾蓝，状态语义色保持不变。
    expect(mistLightColors.primary).toBe(studyCommitMistBlueColors.action)
    expect(mistLightColors.text).toBe(studyCommitMistBlueColors.ink)
    expect(mistLightColors.danger).toBe(lightColors.danger)
    expect(mistLightColors.success).toBe(lightColors.success)
    expect(mistLightColors.warning).toBe(lightColors.warning)
  })

  it('雾蓝纸面色板导出完整键位', () => {
    expect(Object.keys(studyCommitMistBlueColors).sort()).toEqual([
      'accent',
      'action',
      'actionSurface',
      'actionSurfaceStrong',
      'canvas',
      'ink',
      'line',
      'lineStrong',
      'muted',
      'mutedFaint',
      'mutedSoft',
      'paper',
      'scrim',
      'selectedSurface',
      'surfaceSoft',
      'surfaceWarm',
      'timeline',
    ])
  })

  it('uses portable hexadecimal color values', () => {
    for (const value of [
      ...Object.values(lightColors),
      ...Object.values(darkColors),
      ...Object.values(mistLightColors),
      ...Object.values(studyCommitMistBlueColors),
    ]) {
      expect(value).toMatch(/^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/i)
    }
  })

  it('exports valid shared numeric scales', () => {
    expect(Object.values(spacing).every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
    expect(Object.values(radii).every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
    expect(Object.values(sizes).every((value) => Number.isFinite(value) && value > 0)).toBe(true)
    expect(motion.durationFast).toBeLessThanOrEqual(motion.durationNormal)
    expect(motion.durationNormal).toBeLessThanOrEqual(motion.durationSlow)

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
    expect(mistLightColors.primary).toBe('#4A6388')
  })
})
