import { describe, expect, it } from 'vitest'
import { getMenuPosition } from './menu-position'

describe('getMenuPosition', () => {
  it('空间充足时在触发器下方留出间距并对齐左边', () => {
    expect(
      getMenuPosition(
        { left: 100, top: 80, bottom: 120, width: 180 },
        { width: 800, height: 600 },
        160,
      ),
    ).toEqual({ left: 100, top: 126, width: 180, maxHeight: 160, placement: 'bottom' })
  })
  it('底部空间不足时向上展开', () => {
    const result = getMenuPosition(
      { left: 100, top: 500, bottom: 540, width: 180 },
      { width: 800, height: 600 },
      180,
    )
    expect(result.placement).toBe('top')
    expect(result.top + result.maxHeight).toBe(494)
  })
  it('靠右的菜单避让窗口边缘且长列表限制高度', () => {
    const result = getMenuPosition(
      { left: 730, top: 80, bottom: 120, width: 180 },
      { width: 800, height: 600 },
      1200,
    )
    expect(result.left + result.width).toBe(792)
    expect(result.maxHeight).toBe(280)
  })
  it('窄窗口和上下空间都不足时保持菜单在可视范围', () => {
    const result = getMenuPosition(
      { left: 0, top: 90, bottom: 130, width: 180 },
      { width: 140, height: 200 },
      600,
    )
    expect(result.left).toBe(8)
    expect(result.width).toBe(124)
    expect(result.top).toBeGreaterThanOrEqual(8)
    expect(result.top + result.maxHeight).toBeLessThanOrEqual(192)
  })
})
