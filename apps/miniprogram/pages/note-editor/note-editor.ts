import { MONITOR_EVENTS } from '../../constants/events'
import { monitor } from '../../services/monitor-adapter'
import { getMockPapersApi } from '../../services/mock-papers'

Page({
  data: {
    content: '',
    isSaving: false,
  },

  onShow() {
    monitor.track(MONITOR_EVENTS.NOTE_EDITOR_OPEN)
  },

  onContentInput(event: WechatMiniprogram.Input) {
    this.setData({ content: event.detail.value })
  },

  async saveNote() {
    if (this.data.isSaving) {
      return
    }

    monitor.track(MONITOR_EVENTS.NOTE_SAVE_CLICK)

    const content = this.data.content.trim()
    if (!content) {
      wx.showToast({ title: '先写下学习内容', icon: 'none' })
      return
    }

    this.setData({ isSaving: true })

    try {
      await getMockPapersApi().create({ content })
      monitor.track(MONITOR_EVENTS.NOTE_SAVE_SUCCESS)
      wx.showToast({ title: '已记下', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 300)
    } catch (error) {
      this.setData({ isSaving: false })
      monitor.captureError(error, {
        action: MONITOR_EVENTS.NOTE_SAVE_FAILED,
      })
      wx.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    }
  },
})
