import { useRef, useState } from 'react'
import {
  AUTH_ACCOUNT_MAX_LENGTH,
  AUTH_ERROR,
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  authAgreementFooter,
  authCanSubmit,
  authSubmitLabel,
  authSwitchPrompt,
  extractAuthErrorMessage,
  validateAuthSubmit,
} from '@studycommit/common/auth-runtime'
import type { DesktopAuthSession } from './session'

type AuthMode = 'login' | 'register'

type AuthApiLike = {
  registerAccount: (input: { account: string; password: string }) => Promise<{
    ok: boolean
    error?: { message?: string }
    data?: { account: string }
  }>
  loginAccount: (input: { account: string; password: string }) => Promise<{
    ok: boolean
    error?: { message?: string }
    data?: DesktopAuthSession
  }>
}

export function AuthPage({
  api,
  onSession,
}: {
  api: AuthApiLike
  onSession: (session: DesktopAuthSession) => void
}) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const accountRef = useRef<HTMLInputElement>(null)

  const canSubmit = authCanSubmit(mode, { account, password, confirmPassword }, submitting)

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
    setNotice(null)
    setPassword('')
    setConfirmPassword('')
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'register') {
        const submitError = validateAuthSubmit(mode, { account, password, confirmPassword })
        if (submitError) {
          setError(submitError)
          return
        }
        const result = await api.registerAccount({ account: account.trim(), password })
        if (!result.ok) {
          setPassword('')
          setConfirmPassword('')
          setError(result.error?.message ?? AUTH_ERROR.registerFallback)
          return
        }
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setNotice(AUTH_ERROR.registerSuccessNotice)
        accountRef.current?.focus()
        return
      }
      const result = await api.loginAccount({ account: account.trim(), password })
      if (!result.ok) {
        setPassword('')
        setError(result.error?.message ?? AUTH_ERROR.loginFallback)
        return
      }
      if (!result.data) {
        setPassword('')
        setError(AUTH_ERROR.loginResponseMalformed)
        return
      }
      onSession(result.data)
    } catch (requestError) {
      setPassword('')
      setConfirmPassword('')
      setError(
        extractAuthErrorMessage(
          requestError,
          mode === 'register' ? AUTH_ERROR.registerFallback : AUTH_ERROR.loginFallback,
        ),
      )
    } finally {
      setSubmitting(false)
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
            <span className="auth-form__kicker">{mode === 'login' ? '欢迎回来' : '创建账户'}</span>
            <h1 id="auth-title">{mode === 'login' ? '登录' : '注册'}</h1>
          </div>
        </div>

        <form
          className="auth-fields"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label className="auth-field">
            账号
            <input
              ref={accountRef}
              autoComplete="username"
              maxLength={AUTH_ACCOUNT_MAX_LENGTH}
              placeholder={`2 到 ${AUTH_ACCOUNT_MAX_LENGTH} 个字符`}
              value={account}
              onChange={(event) => setAccount(event.target.value)}
            />
          </label>
          <label className="auth-field">
            密码
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              maxLength={AUTH_PASSWORD_MAX_LENGTH}
              placeholder={`至少 ${AUTH_PASSWORD_MIN_LENGTH} 位`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="auth-form__footnote auth-toggle-password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? '隐藏密码' : '显示密码'}
          </button>
          {mode === 'register' ? (
            <label className="auth-field">
              确认密码
              <input
                type="password"
                autoComplete="new-password"
                maxLength={AUTH_PASSWORD_MAX_LENGTH}
                placeholder="再输入一次密码"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          ) : null}
          {notice ? <p className="auth-form__footnote">{notice}</p> : null}
          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="button auth-form__submit" disabled={!canSubmit}>
            {authSubmitLabel(mode, submitting)}
          </button>
          <button
            type="button"
            className="auth-form__footnote"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          >
            {authSwitchPrompt(mode)}
          </button>
          <p className="auth-form__footnote">{authAgreementFooter(mode)}</p>
        </form>
      </div>
    </section>
  )
}
