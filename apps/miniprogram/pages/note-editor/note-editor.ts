interface LocalNote {
  id: string
  content: string
  isQuestion: boolean
  isResolved: boolean
  createdAt: string
}

const NOTES_STORAGE_KEY = 'studycommit.notes'

Page({
  data: {
    content: '',
    isQuestion: false,
  },

  onContentInput(event: WechatMiniprogram.Input) {
    this.setData({ content: event.detail.value })
  },

  toggleQuestion() {
    this.setData({ isQuestion: !this.data.isQuestion })
  },

  saveNote() {
    const content = this.data.content.trim()
    if (!content) {
      wx.showToast({ title: '先写下学习内容', icon: 'none' })
      return
    }

    const notes = (wx.getStorageSync(NOTES_STORAGE_KEY) as LocalNote[] | undefined) ?? []
    notes.unshift({
      id: `${Date.now()}`,
      content,
      isQuestion: this.data.isQuestion,
      isResolved: false,
      createdAt: new Date().toISOString(),
    })
    wx.setStorageSync(NOTES_STORAGE_KEY, notes)
    wx.showToast({ title: '已记下', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 300)
  },
})
