import { getMiniprogramServices } from '../../infrastructure/services/service-context'
import { ROUTES } from '../../constants/routes'

let submitting = false

Page({
  data: {
    loggingIn: true,
    error: '',
  },

  async onShow() {
    await getMiniprogramServices().auth.ensureSession()
    if (getMiniprogramServices().auth.isAuthenticated()) {
      wx.reLaunch({ url: ROUTES.HOME })
      return
    }
    if (this.data.loggingIn && !submitting) {
      this.setData({ loggingIn: false })
    }
  },

  onWechatLogin() {
    if (this.data.loggingIn || submitting) {
      return
    }
    submitting = true
    this.setData({ loggingIn: true, error: '' })
    wx.login({
      success: (result) => {
        void this.completeLogin(result.code)
      },
      fail: () => {
        submitting = false
        this.setData({ loggingIn: false, error: '微信登录失败，请重试' })
      },
    })
  },

  async completeLogin(code: string) {
    if (!code) {
      submitting = false
      this.setData({ loggingIn: false, error: '未取得微信登录码' })
      return
    }
    try {
      await getMiniprogramServices().auth.login(code)
      wx.reLaunch({ url: ROUTES.HOME })
    } catch {
      submitting = false
      this.setData({ loggingIn: false, error: '登录失败，请重试' })
    }
  },
})
