import { getApiBaseUrl } from './services/api-config'
import { bootstrapMiniprogramAuth } from './services/auth-bootstrap'
import { monitor } from './services/monitor-adapter'
import { MONITOR_EVENTS } from './constants/events'

App({
  globalData: {
    apiBaseUrl: getApiBaseUrl(),
  },
  authReady: undefined as unknown as Promise<boolean>,

  onLaunch() {
    monitor.track(MONITOR_EVENTS.APP_LAUNCH)
    this.authReady = bootstrapMiniprogramAuth()
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
