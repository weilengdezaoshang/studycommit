export type CustomNavigationMetrics = {
  statusBarHeight: number
  navigationBarHeight: number
}

const FALLBACK_NAVIGATION_BAR_HEIGHT = 44

export function getCustomNavigationMetrics(): CustomNavigationMetrics {
  try {
    const windowInfo = wx.getWindowInfo()
    const statusBarHeight = windowInfo.statusBarHeight ?? 0
    const capsule = wx.getMenuButtonBoundingClientRect()
    const capsuleGap = Math.max(0, capsule.top - statusBarHeight)
    const navigationBarHeight = capsule.height + capsuleGap * 2

    return {
      statusBarHeight,
      navigationBarHeight: navigationBarHeight || FALLBACK_NAVIGATION_BAR_HEIGHT,
    }
  } catch {
    const statusBarHeight = 0
    return {
      statusBarHeight,
      navigationBarHeight: FALLBACK_NAVIGATION_BAR_HEIGHT,
    }
  }
}
