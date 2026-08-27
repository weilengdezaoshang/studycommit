import { MONITOR_EVENTS } from '../../constants/events'
import { ROUTES } from '../../constants/routes'
import { monitor } from '../../services/monitor-adapter'

Page({
  startWriting() {
    monitor.track(MONITOR_EVENTS.HOME_OPEN_NOTE_EDITOR)
    wx.navigateTo({ url: ROUTES.NOTE_EDITOR })
  },
})
