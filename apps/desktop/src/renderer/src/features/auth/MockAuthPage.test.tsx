import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MockAuthPage } from './MockAuthPage'

describe('MockAuthPage', () => {
  it('defaults to login and requires valid credentials', () => {
    render(<MockAuthPage />)
    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument()
    expect(screen.getByLabelText('邮箱')).toBeRequired()
    expect(screen.getByLabelText('密码')).toBeRequired()
  })

  it('switches to register and exposes confirmation validation', () => {
    render(<MockAuthPage />)
    fireEvent.click(screen.getByRole('button', { name: '注册' }))
    expect(screen.getByRole('heading', { name: '创建 StudyCommit' })).toBeInTheDocument()
    expect(screen.getByLabelText('确认密码')).toHaveAttribute('minlength', '8')
    expect(screen.getByRole('button', { name: '创建账户' })).toBeInTheDocument()
  })

  it('shows a mock success only after a valid form submission', () => {
    render(<MockAuthPage />)
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'reader@example.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: '登录 StudyCommit' }).closest('form')!)
    expect(screen.getByRole('status')).toHaveTextContent('Mock 请求成功')
  })

  it('rejects mismatched passwords during registration', () => {
    render(<MockAuthPage />)
    fireEvent.click(screen.getByRole('button', { name: '注册' }))
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'reader@example.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'different123' } })
    fireEvent.submit(screen.getByRole('button', { name: '创建账户' }).closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('两次输入的密码不一致')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
