import { describe, expect, it } from 'vitest'
import { captureActionsPosition } from './CaptureSelectionActions'

describe('截图操作栏位置', () => {
  it('空间足够时位于选区下方并右侧对齐', () => {
    expect(
      captureActionsPosition({ x: 100, y: 100, width: 680, height: 350 }, 540, 70, 900, 600),
    ).toEqual({ left: 240, top: 462 })
  })
  it('底部空间不足时翻到选区上方', () => {
    expect(
      captureActionsPosition({ x: 100, y: 300, width: 680, height: 290 }, 540, 70, 900, 600),
    ).toEqual({ left: 240, top: 218 })
  })
  it('窄选区和全屏选区不会使操作栏越过屏幕边缘', () => {
    expect(
      captureActionsPosition({ x: 0, y: 0, width: 30, height: 600 }, 540, 70, 900, 600),
    ).toEqual({ left: 12, top: 12 })
  })
  it('未选择区域时操作栏停靠右下角', () => {
    expect(captureActionsPosition(null, 540, 70, 900, 600)).toEqual({ left: 348, top: 518 })
  })
})
