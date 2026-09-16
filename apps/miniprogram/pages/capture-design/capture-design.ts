import { captureScenarios } from '../../shared/capture-runtime/index'
Page({
  data: { scenarios: captureScenarios.map(([id, title]) => ({ id, title })) },
  open(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({
      url:
        '/pages/capture/capture?scenario=' +
        encodeURIComponent(String(event.currentTarget.dataset.id)),
    })
  },
})
