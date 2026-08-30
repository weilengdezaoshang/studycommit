import { useEffect, useState } from 'react'
import type { DesktopAuthSession } from './session'

type AuthTab = 'wechat-qr' | 'phone'

type AuthApiLike = {
  sendPhoneCode: (input: { phone: string }) => Promise<unknown>
  verifyPhone: (input: {
    phone: string
    code: string
    deviceType: 'desktop'
  }) => Promise<{ ok: boolean; error?: { message?: string }; data?: unknown }>
}

/**
 * 桌面端登录页(登录即注册):微信扫码优先,手机号验证码兜底。
 * PRD:验证码 60 秒重发;失败保留手机号、只清空验证码,不暴露注册状态。
 */
export function AuthPage({
  api,
  onSession,
}: {
  api: AuthApiLike
  onSession: (session: DesktopAuthSession) => void
}) {
  const [tab, setTab] = useState<AuthTab>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [codeSending, setCodeSending] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [resendLeft, setResendLeft] = useState(0)

  useEffect(() => {
    if (resendLeft <= 0) {
      return undefined
    }
    const timer = setInterval(() => setResendLeft((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendLeft])

  const phoneValid = /^1\d{10}$/.test(phone)

  const requestCode = async () => {
    setCodeSending(true)
    setError(null)
    try {
      const result = (await api.sendPhoneCode({ phone })) as {
        ok: boolean
        error?: { message?: string }
      }
      if (!result.ok) {
        setError(result.error?.message ?? '验证码发送失败')
        return
      }
      setResendLeft(60)
    } catch (requestError) {
      setError(extractError(requestError, '验证码发送失败'))
    } finally {
      setCodeSending(false)
    }
  }

  const login = async () => {
    setLoggingIn(true)
    setError(null)
    try {
      const result = (await api.verifyPhone({ phone, code, deviceType: 'desktop' })) as {
        ok: boolean
        error?: { message?: string }
        data?: DesktopAuthSession
      }
      if (!result.ok) {
        setCode('')
        setError(result.error?.message ?? '登录失败')
        return
      }
      if (!result.data) {
        setCode('')
        setError('登录响应格式异常')
        return
      }
      onSession(result.data)
    } catch (requestError) {
      setCode('')
      setError(extractError(requestError, '登录失败'))
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <section className="auth-page" aria-labelledby="auth-title">
      <div className="auth-page__intro">
        <span className="brand__mark" aria-hidden="true">
          S
        </span>
        <h2>零散的记录，也值得好好收着。</h2>
        <p>登录后，箱子与记录会在设备之间安静同步。</p>
        <span className="auth-page__kicker">STUDY NOTES</span>
      </div>

      <div className="auth-form">
        <div className="auth-form__heading">
          <div>
            <span className="auth-form__kicker">欢迎回来</span>
            <h1 id="auth-title">登录与注册共用一个入口</h1>
          </div>
          <div className="auth-tabs">
            <button
              type="button"
              className={tab === 'wechat-qr' ? 'is-active' : ''}
              onClick={() => setTab('wechat-qr')}
            >
              微信扫码
            </button>
            <button
              type="button"
              className={tab === 'phone' ? 'is-active' : ''}
              onClick={() => setTab('phone')}
            >
              手机号
            </button>
          </div>
        </div>

        {tab === 'wechat-qr' ? (
          <div className="qr-panel">
            <div className="qr-placeholder" role="img" aria-label="微信登录二维码占位">
              <span>二维码</span>
            </div>
            <p className="qr-hint">使用微信扫码，在手机上确认登录</p>
            <p className="qr-pending">微信扫码登录暂未开通，请先使用手机号验证码登录</p>
          </div>
        ) : (
          <form
            className="auth-fields"
            onSubmit={(event) => {
              event.preventDefault()
              void login()
            }}
          >
            <label className="auth-field">
              手机号
              <input
                inputMode="numeric"
                maxLength={11}
                placeholder="11 位手机号"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
              />
            </label>
            <div className="auth-code-row">
              <input
                className="auth-field__inner"
                inputMode="numeric"
                maxLength={6}
                placeholder="验证码"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
              <button
                type="button"
                className="auth-code-button"
                disabled={!phoneValid || resendLeft > 0 || codeSending}
                onClick={() => void requestCode()}
              >
                {codeSending ? '发送中' : resendLeft > 0 ? `${resendLeft}s 后重发` : '获取验证码'}
              </button>
            </div>
            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="button auth-form__submit"
              disabled={!phoneValid || code.length !== 6 || loggingIn}
            >
              {loggingIn ? '登录中' : '登录'}
            </button>
            <p className="auth-form__footnote">首次验证将自动创建 StudyCommit 账户</p>
            <p className="auth-form__footnote">登录即代表你同意《用户协议》和《隐私政策》</p>
          </form>
        )}
      </div>
    </section>
  )
}

function extractError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const payload = (error as { error?: { message?: string } }).error
    if (payload?.message) {
      return payload.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
