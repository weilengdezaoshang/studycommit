import { useState } from 'react'

type AuthMode = 'login' | 'register'

export function MockAuthPage(): React.JSX.Element {
  const [mode, setMode] = useState<AuthMode>('login')
  const [submitted, setSubmitted] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const isLogin = mode === 'login'
  return (
    <section className="auth-page" aria-labelledby="auth-title">
      <div className="auth-page__intro">
        <span className="brand__mark" aria-hidden="true">
          S
        </span>
        <h2>把学习痕迹，留在自己的地方。</h2>
        <p>登录后，桌面端、移动端和小程序会共享同一套纸页、问题与主题箱子。</p>
      </div>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!isLogin && password !== confirmation) {
            setSubmitted(false)
            setError('两次输入的密码不一致')
          } else {
            setError('')
            setSubmitted(true)
          }
        }}
      >
        <div className="auth-form__heading">
          <div>
            <span className="mock-label">示例登录</span>
            <h1 id="auth-title">{isLogin ? '欢迎回来' : '创建 StudyCommit'}</h1>
          </div>
          <div className="auth-tabs">
            <button
              type="button"
              className={isLogin ? 'is-active' : ''}
              onClick={() => {
                setMode('login')
                setSubmitted(false)
              }}
            >
              登录
            </button>
            <button
              type="button"
              className={!isLogin ? 'is-active' : ''}
              onClick={() => {
                setMode('register')
                setSubmitted(false)
              }}
            >
              注册
            </button>
          </div>
        </div>
        <label className="auth-field">
          邮箱
          <input type="email" placeholder="you@example.com" required />
        </label>
        <label className="auth-field">
          密码
          <input
            type="password"
            placeholder="至少 8 位字符"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {!isLogin ? (
          <label className="auth-field">
            确认密码
            <input
              type="password"
              placeholder="再次输入密码"
              minLength={8}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
          </label>
        ) : null}
        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}
        {submitted ? (
          <p className="auth-form__success" role="status">
            Mock 请求成功，真实鉴权接口接入后将在这里建立会话。
          </p>
        ) : null}
        <button type="submit" className="button auth-form__submit">
          {isLogin ? '登录 StudyCommit' : '创建账户'}
        </button>
        <p className="auth-form__footnote">当前为前端 Mock，不会发送真实账号信息。</p>
      </form>
    </section>
  )
}
