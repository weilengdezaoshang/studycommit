import { MONITOR_EVENTS } from '../../constants/events'
import { monitor } from '../../services/monitor-adapter'
import { getMockPapersApi } from '../../services/mock-papers'
import { formatEditorDate, parseNoteDraft, type NoteDraft } from './note-editor-utils'

const NOTE_DRAFT_STORAGE_KEY = 'studycommit.note-editor.draft'
let navigateBackTimer: ReturnType<typeof setTimeout> | undefined

Page({
  data: {
    statusBarHeight: 0,
    content: '',
    editorDate: '',
    editorSignature: '',
    isQuestionActive: false,
    photoPath: '',
    isSaving: false,
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const draft = parseNoteDraft(wx.getStorageSync(NOTE_DRAFT_STORAGE_KEY))
    const editorDate = formatEditorDate(new Date())
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight ?? 0,
      content: draft.content,
      isQuestionActive: draft.isQuestionActive,
      photoPath: draft.photoPath,
      editorDate: editorDate.dateLabel,
      editorSignature: editorDate.signatureLabel,
    })
  },

  onShow() {
    monitor.track(MONITOR_EVENTS.NOTE_EDITOR_OPEN)
  },

  onUnload() {
    if (navigateBackTimer) {
      clearTimeout(navigateBackTimer)
    }
  },

  onContentInput(event: WechatMiniprogram.Input) {
    const content = event.detail.value
    this.setData({ content })
    this.persistDraft({ content })
  },

  cancelWriting() {
    wx.navigateBack()
  },

  toggleQuestion() {
    const isQuestionActive = !this.data.isQuestionActive
    this.setData({ isQuestionActive })
    this.persistDraft({ isQuestionActive })
  },

  choosePhoto() {
    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (result) => {
        const tempFilePath = result.tempFilePaths[0]
        if (!tempFilePath) {
          return
        }
        wx.getFileSystemManager().saveFile({
          tempFilePath,
          success: ({ savedFilePath }) => {
            this.setData({ photoPath: savedFilePath })
            this.persistDraft({ photoPath: savedFilePath })
          },
          fail: (error) => {
            monitor.captureError(error, { action: MONITOR_EVENTS.NOTE_SAVE_FAILED })
            wx.showToast({ title: '图片保存失败，请重试', icon: 'none' })
          },
        })
      },
      fail: (error) => {
        if (String(error.errMsg).includes('cancel')) {
          return
        }
        monitor.captureError(error, { action: MONITOR_EVENTS.NOTE_SAVE_FAILED })
        wx.showToast({ title: '无法读取图片，请检查权限', icon: 'none' })
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
      await getMockPapersApi().create({
        content,
        hasQuestion: this.data.isQuestionActive,
        photoPath: this.data.photoPath,
      })
      wx.removeStorageSync(NOTE_DRAFT_STORAGE_KEY)
      monitor.track(MONITOR_EVENTS.NOTE_SAVE_SUCCESS)
      wx.showToast({ title: '已记下', icon: 'success' })
      navigateBackTimer = setTimeout(() => wx.navigateBack(), 300)
    } catch (error) {
      this.setData({ isSaving: false })
      monitor.captureError(error, {
        action: MONITOR_EVENTS.NOTE_SAVE_FAILED,
      })
      wx.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    }
  },

  persistDraft(patch: Partial<NoteDraft>) {
    const draft: NoteDraft = {
      content: patch.content ?? this.data.content,
      isQuestionActive: patch.isQuestionActive ?? this.data.isQuestionActive,
      photoPath: patch.photoPath ?? this.data.photoPath,
    }
    wx.setStorageSync(NOTE_DRAFT_STORAGE_KEY, draft)
  },
})
