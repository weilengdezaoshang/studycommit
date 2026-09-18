import { App, ConfigProvider } from 'antd'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RolesPage from './index'
import { adminApi } from '@/services/admin-api'
import { queryClient } from '@/services/query-client'

vi.mock('@/services/admin-api', () => ({
  adminApi: {
    listRoles: vi.fn(),
    grantRole: vi.fn(),
  },
}))

const USER = '22222222-2222-4222-8222-222222222222'

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfigProvider button={{ autoInsertSpace: false }}>
        <App>
          <RolesPage />
        </App>
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  queryClient.clear()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(adminApi.listRoles).mockResolvedValue({
    items: [
      {
        userId: '11111111-1111-4111-8111-111111111111',
        role: 'super_admin',
        grantedBy: null,
        reason: '初始管理员',
        createdAt: '2026-08-01T10:24:00+08:00',
      },
    ],
  })
})

describe('RolesPage', () => {
  it('用户已存在但角色未变时不能宣布本次授权成功', async () => {
    vi.mocked(adminApi.grantRole).mockRejectedValue(new Error('network'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '授予角色' }))
    fireEvent.change(screen.getByLabelText('用户 ID'), { target: { value: USER } })
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByText('publisher（活动发布）'))
    fireEvent.change(screen.getByPlaceholderText('请输入操作理由'), {
      target: { value: '授予发布者' },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认授权' }))
    await waitFor(() => expect(screen.getAllByText('操作结果待确认').length).toBeGreaterThan(0))
    vi.mocked(adminApi.listRoles).mockResolvedValue({
      items: [
        {
          userId: USER,
          role: 'operator',
          grantedBy: null,
          reason: '旧授权',
          createdAt: '2026-09-01T00:00:00+08:00',
        },
      ],
    })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /查询结果/ }))
    await waitFor(() =>
      expect(screen.getAllByText(/当前角色为 活动草稿/).length).toBeGreaterThan(0),
    )
    expect(screen.queryByText('已确认本次授权：目标用户已具备提交的角色')).toBeNull()
  }, 15000)

  it('查询失败时不得作为成功证据', async () => {
    vi.mocked(adminApi.grantRole).mockRejectedValue(new Error('network'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '授予角色' }))
    fireEvent.change(screen.getByLabelText('用户 ID'), { target: { value: USER } })
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByText('publisher（活动发布）'))
    fireEvent.change(screen.getByPlaceholderText('请输入操作理由'), {
      target: { value: '授予发布者' },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认授权' }))
    await waitFor(() => expect(screen.getAllByText('操作结果待确认').length).toBeGreaterThan(0))
    vi.mocked(adminApi.listRoles).mockRejectedValue(new Error('角色列表读取失败'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /查询结果/ }))
    await waitFor(() =>
      expect(screen.getAllByText(/查询失败：角色列表读取失败/).length).toBeGreaterThan(0),
    )
    expect(screen.getAllByRole('button', { name: /查询结果/ }).length).toBeGreaterThan(0)
  }, 15000)

  it('关闭弹窗后仍能从页面重新查询授权结果', async () => {
    vi.mocked(adminApi.grantRole).mockRejectedValue(new Error('network'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '授予角色' }))
    fireEvent.change(screen.getByLabelText('用户 ID'), { target: { value: USER } })
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByText('publisher（活动发布）'))
    fireEvent.change(screen.getByPlaceholderText('请输入操作理由'), {
      target: { value: '授予发布者' },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认授权' }))
    await waitFor(() => expect(screen.getAllByText('操作结果待确认').length).toBeGreaterThan(0))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }))
    expect(screen.getAllByRole('button', { name: /查询结果/ })[0].hasAttribute('disabled')).toBe(
      false,
    )
    vi.mocked(adminApi.listRoles).mockResolvedValue({
      items: [
        {
          userId: USER,
          role: 'publisher',
          grantedBy: '11111111-1111-4111-8111-111111111111',
          reason: '授予发布者',
          createdAt: '2026-09-18T00:00:00+08:00',
        },
      ],
    })
    fireEvent.click(screen.getAllByRole('button', { name: /查询结果/ })[0])
    await waitFor(() => expect(adminApi.listRoles).toHaveBeenCalled())
  }, 15000)
})
