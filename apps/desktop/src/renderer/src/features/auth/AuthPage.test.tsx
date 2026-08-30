import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

const api = {
  sendPhoneCode: vi.fn(),
  verifyPhone: vi.fn(),
}

describe('AuthPage', () => {
  it('默认展示手机号登录表单与协议文案', () => {
    render(<AuthPage api={api} onSession={() => undefined} />)

    expect(screen.getByLabelText('手机号')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('验证码')).toBeInTheDocument()
    expect(screen.getByText('登录即代表你同意《用户协议》和《隐私政策》')).toBeInTheDocument()
  })

  it('未填手机号时获取验证码按钮不可用', async () => {
    const user = userEvent.setup()
    render(<AuthPage api={api} onSession={() => undefined} />)

    const button = screen.getByRole('button', { name: '获取验证码' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    expect(button).toBeEnabled()
  })

  it('验证失败时保留手机号并只清空验证码', async () => {
    api.verifyPhone.mockResolvedValue({
      ok: false,
      error: { message: '验证码错误，请重新输入' },
    })
    const user = userEvent.setup()
    render(<AuthPage api={api} onSession={() => undefined} />)

    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.type(screen.getByPlaceholderText('验证码'), '000000')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('验证码错误，请重新输入')
    expect(screen.getByLabelText('手机号')).toHaveValue('13800138000')
    expect(screen.getByPlaceholderText('验证码')).toHaveValue('')
  })

  it('验证成功后把会话交给 onSession', async () => {
    const onSession = vi.fn()
    const session = {
      user: { id: 'u1', nickname: 'n', avatarUrl: null, status: 'active' },
      tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: '2026-09-30T00:00:00.000Z' },
    }
    api.verifyPhone.mockResolvedValue({ ok: true, data: session })
    const user = userEvent.setup()
    render(<AuthPage api={api} onSession={onSession} />)

    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.type(screen.getByPlaceholderText('验证码'), '123456')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(onSession).toHaveBeenCalledWith(session)
  })

  it('微信扫码页展示待开通说明', async () => {
    const user = userEvent.setup()
    render(<AuthPage api={api} onSession={() => undefined} />)

    await user.click(screen.getByRole('button', { name: '微信扫码' }))
    expect(screen.getByText('使用微信扫码，在手机上确认登录')).toBeInTheDocument()
    expect(screen.getByText(/微信扫码登录暂未开通/)).toBeInTheDocument()
  })
})
