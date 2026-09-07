import { describe, expect, it } from 'vitest'
import { isCaptureId, isCaptureSelection } from './capture-channels'

describe('capture channel guards', () => {
  it('captureId 只接受 UUID 字符串', () => {
    expect(isCaptureId('2f0c9d92-58a2-4c6e-9f7a-1d1c2b3a4e5f')).toBe(true)
    expect(isCaptureId('not-a-uuid')).toBe(false)
    expect(isCaptureId(123)).toBe(false)
    expect(isCaptureId(undefined)).toBe(false)
  })

  it('选区必须是整数坐标且宽高至少为 1', () => {
    expect(isCaptureSelection({ x: 10, y: 20, width: 100, height: 50 })).toBe(true)
    expect(isCaptureSelection({ x: 0, y: 0, width: 1, height: 1 })).toBe(true)
    expect(isCaptureSelection({ x: -1, y: 0, width: 100, height: 50 })).toBe(false)
    expect(isCaptureSelection({ x: 10, y: 20, width: 0, height: 50 })).toBe(false)
    expect(isCaptureSelection({ x: 1.5, y: 20, width: 100, height: 50 })).toBe(false)
    expect(isCaptureSelection({ x: 10, y: 20 })).toBe(false)
    expect(isCaptureSelection(null)).toBe(false)
    expect(isCaptureSelection('rect')).toBe(false)
  })
})
