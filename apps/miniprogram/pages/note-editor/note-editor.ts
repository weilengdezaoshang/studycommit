import { MONITOR_EVENTS } from '../../constants/events'
import { monitor } from '../../services/monitor-adapter'

interface LocalNote {
  id: string
  content: string
  isQuestion: boolean
  isResolved: boolean
  createdAt: string
}

const NOTES_STORAGE_KEY = 'studycommit.notes' as const

Page({
  data: {
    content: '',
    isQuestion: false,
    isSaving: false,
  },

  onShow() {
    monitor.track(MONITOR_EVENTS.NOTE_EDITOR_OPEN)
  },

  onContentInput(event: WechatMiniprogram.Input) {
    this.setData({ content: event.detail.value })
  },

  toggleQuestion() {
    const isQuestion = !this.data.isQuestion
    this.setData({ isQuestion })
    monitor.track(MONITOR_EVENTS.NOTE_QUESTION_TOGGLE, { isQuestion })
  },

  saveNote() {
    if (this.data.isSaving) {
      return
    }

    monitor.track(MONITOR_EVENTS.NOTE_SAVE_CLICK, {
      isQuestion: this.data.isQuestion,
    })

    const content = this.data.content.trim()
    if (!content) {
      wx.showToast({ title: '先写下学习内容', icon: 'none' })
      return
    }

    this.setData({ isSaving: true })

    try {
      const storedNotes = wx.getStorageSync(NOTES_STORAGE_KEY)
      const notes = Array.isArray(storedNotes) ? (storedNotes as LocalNote[]) : []
      notes.unshift({
        id: `${Date.now()}`,
        content,
        isQuestion: this.data.isQuestion,
        isResolved: false,
        createdAt: new Date().toISOString(),
      })
      wx.setStorageSync(NOTES_STORAGE_KEY, notes)
      monitor.track(MONITOR_EVENTS.NOTE_SAVE_SUCCESS, {
        isQuestion: this.data.isQuestion,
      })
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
