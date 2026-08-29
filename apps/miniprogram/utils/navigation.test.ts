import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCustomNavigationMetrics } from './navigation'

describe('getCustomNavigationMetrics', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('根据状态栏和微信胶囊计算导航高度', () => {
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ statusBarHeight: 47 }),
      getMenuButtonBoundingClientRect: () => ({ top: 51, height: 32 }),
    })

    expect(getCustomNavigationMetrics()).toEqual({
      statusBarHeight: 47,
      navigationBarHeight: 40,
    })
  })

  it('系统信息不可用时回退到安全默认值', () => {
    vi.stubGlobal('wx', {
      getWindowInfo: () => {
        throw new Error('unavailable')
      },
    })

    expect(getCustomNavigationMetrics()).toEqual({
      statusBarHeight: 0,
      navigationBarHeight: 44,
    })
  })
})
