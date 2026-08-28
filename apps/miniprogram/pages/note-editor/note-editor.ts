import { MONITOR_EVENTS } from '../../constants/events'
import { monitor } from '../../services/monitor-adapter'
import { getMockPapersApi } from '../../services/mock-papers'

const NOTE_DRAFT_STORAGE_KEY = 'studycommit.note-editor.draft'

Page({
  data: {
    statusBarHeight: 0,
    content: '',
    editorDate: 'AUG 27',
    isQuestionActive: false,
    photoPath: '',
    isSaving: false,
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const draft = wx.getStorageSync(NOTE_DRAFT_STORAGE_KEY)
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight ?? 0,
      content: typeof draft === 'string' ? draft : '',
    })
  },

  onShow() {
    monitor.track(MONITOR_EVENTS.NOTE_EDITOR_OPEN)
  },

  onContentInput(event: WechatMiniprogram.Input) {
    const content = event.detail.value
    this.setData({ content })
    wx.setStorageSync(NOTE_DRAFT_STORAGE_KEY, content)
  },

  cancelWriting() {
    wx.navigateBack()
  },

  toggleQuestion() {
    this.setData({ isQuestionActive: !this.data.isQuestionActive })
  },

  choosePhoto() {
    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (result) => {
        this.setData({ photoPath: result.tempFilePaths[0] ?? '' })
      },
      fail: (error) => {
        monitor.captureError(error, { action: MONITOR_EVENTS.NOTE_SAVE_FAILED })
      },
    })
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
      wx.removeStorageSync(NOTE_DRAFT_STORAGE_KEY)
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
