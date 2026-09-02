import { loginWechatMiniprogram } from '../../services/auth-api'
import { waitForMiniprogramAuth } from '../../services/auth-bootstrap'
import { getAccessToken } from '../../services/auth-session'
import { ROUTES } from '../../constants/routes'

let submitting = false

Page({
  data: {
    loggingIn: true,
    error: '',
  },

  async onShow() {
    await waitForMiniprogramAuth()
    if (getAccessToken()) {
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
      await loginWechatMiniprogram(code)
      wx.reLaunch({ url: ROUTES.HOME })
    } catch {
      submitting = false
      this.setData({ loggingIn: false, error: '登录失败，请重试' })
    }
  },
})
