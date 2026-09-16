import { getApiBaseUrl } from './services/api-config'
import {
  ensureMiniprogramServicesReady,
  getMiniprogramServices,
} from './infrastructure/services/service-context'
import { monitor } from './services/monitor-adapter'
import { getCloudEnvId } from './constants/cloud'
import { MONITOR_EVENTS } from './constants/events'

App({
  globalData: {
    apiBaseUrl: getApiBaseUrl(),
  },
  authReady: undefined as unknown as Promise<boolean>,

  onLaunch() {
    if (!wx.cloud) {
      // 基础库不支持或未开通云开发：记录明确错误，后续 OCR 调用会返回 OCR_NOT_CONFIGURED。
      monitor.captureError('当前基础库不支持云开发，图片识别不可用', {
        action: MONITOR_EVENTS.APP_ERROR,
      })
    } else {
      wx.cloud.init({ env: getCloudEnvId() || undefined, traceUser: true })
    }
    monitor.track(MONITOR_EVENTS.APP_LAUNCH)
    // 统一业务服务：会话引导 + 能力开关刷新（服务端最终决定权）。
    this.authReady = getMiniprogramServices().auth.ensureSession()
    void ensureMiniprogramServicesReady()
  },

  onError(error: string) {
    monitor.captureError(error, { action: MONITOR_EVENTS.APP_ERROR })
  },

  onUnhandledRejection(event: WechatMiniprogram.OnUnhandledRejectionListenerResult) {
    monitor.captureError(event.reason, { action: MONITOR_EVENTS.UNHANDLED_REJECTION })
  },

  onPageNotFound(event: WechatMiniprogram.OnPageNotFoundListenerResult) {
    monitor.log.error('页面不存在', {
      action: MONITOR_EVENTS.PAGE_NOT_FOUND,
      path: event.path,
      query: event.query,
    })
  },
})
