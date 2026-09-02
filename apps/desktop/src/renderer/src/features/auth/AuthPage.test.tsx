import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

const api = {
  registerAccount: vi.fn(),
  loginAccount: vi.fn(),
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('默认展示登录表单，可切换到注册', async () => {
    const user = userEvent.setup()
    render(<AuthPage api={api} onSession={() => undefined} />)

    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
    expect(screen.getByLabelText('账号')).toBeInTheDocument()
    expect(screen.getByLabelText('密码')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '没有账号？去注册' }))
    expect(screen.getByRole('heading', { name: '注册' })).toBeInTheDocument()
    expect(screen.getByLabelText('确认密码')).toBeInTheDocument()
  })

  it('账号或密码过短时登录按钮不可用', async () => {
    const user = userEvent.setup()
    render(<AuthPage api={api} onSession={() => undefined} />)

    const button = screen.getByRole('button', { name: '登录' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('账号'), 'demo')
    await user.type(screen.getByLabelText('密码'), 'secret123')
    expect(button).toBeEnabled()
  })

  it('登录失败时保留账号并清空密码', async () => {
    api.loginAccount.mockResolvedValue({
      ok: false,
      error: { message: '账号或密码不正确' },
    })
    const user = userEvent.setup()
    render(<AuthPage api={api} onSession={() => undefined} />)

    await user.type(screen.getByLabelText('账号'), 'demo')
    await user.type(screen.getByLabelText('密码'), 'secret123')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('账号或密码不正确')
    expect(screen.getByLabelText('账号')).toHaveValue('demo')
    expect(screen.getByLabelText('密码')).toHaveValue('')
  })

  it('注册成功后切回登录并提示再登录', async () => {
    api.registerAccount.mockResolvedValue({ ok: true, data: { account: 'demo' } })
    const user = userEvent.setup()
    render(<AuthPage api={api} onSession={() => undefined} />)

    await user.click(screen.getByRole('button', { name: '没有账号？去注册' }))
    await user.type(screen.getByLabelText('账号'), 'demo')
    await user.type(screen.getByLabelText('密码'), 'secret123')
    await user.type(screen.getByLabelText('确认密码'), 'secret123')
    await user.click(screen.getByRole('button', { name: '注册' }))

    expect(await screen.findByText('注册成功，请登录')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
    expect(api.registerAccount).toHaveBeenCalledWith({ account: 'demo', password: 'secret123' })
  })

  it('登录成功后把会话交给 onSession', async () => {
    const onSession = vi.fn()
    const session = {
      user: { id: 'u1', nickname: 'n', avatarUrl: null, status: 'active' },
      tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: '2026-09-30T00:00:00.000Z' },
    }
    api.loginAccount.mockResolvedValue({ ok: true, data: session })
    const user = userEvent.setup()
    render(<AuthPage api={api} onSession={onSession} />)

    await user.type(screen.getByLabelText('账号'), 'demo')
    await user.type(screen.getByLabelText('密码'), 'secret123')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(onSession).toHaveBeenCalledWith(session)
  })
})
