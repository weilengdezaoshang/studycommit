import { App, ConfigProvider } from 'antd'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RunsPage from './index'
import { adminApi } from '@/services/admin-api'
import { AdminApiError } from '@/services/api-client'
import type { RunRow } from '@/services/types'

vi.mock('@/services/admin-api', () => ({
  adminApi: {
    listRuns: vi.fn(),
    getRun: vi.fn(),
  },
}))

const runA: RunRow = {
  runId: '55555555-5555-4555-8555-555555555555',
  userId: '22222222-2222-4222-8222-222222222222',
  kind: 'paper_explain',
  status: 'failed',
  reservation: {
    reservationId: '88888888-8888-4888-8888-888888888888',
    status: 'active',
    amount: 5,
    deadlineAt: '2026-09-17T10:00:00+08:00',
  },
  error: '供应商响应超时',
  createdAt: '2026-09-17T08:21:33+08:00',
}

const runB: RunRow = {
  ...runA,
  runId: '99999999-9999-4999-8999-999999999999',
  error: '另一条失败',
  status: 'completed',
}

function renderPage() {
  return render(
    <ConfigProvider button={{ autoInsertSpace: false }}>
      <App>
        <RunsPage />
      </App>
    </ConfigProvider>,
  )
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(adminApi.listRuns).mockResolvedValue({ items: [runA, runB], nextCursor: null })
})

describe('RunsPage', () => {
  it('刷新状态按 runId 独立查询，不依赖当前列表是否仍包含该记录', async () => {
    vi.mocked(adminApi.getRun).mockResolvedValue({ ...runA, status: 'completed', error: null })
    renderPage()
    await screen.findByText('供应商响应超时')
    fireEvent.click(screen.getByText('供应商响应超时'))
    await screen.findByText('运行详情')
    vi.mocked(adminApi.listRuns).mockResolvedValue({ items: [runB], nextCursor: null })
    fireEvent.click(await screen.findByText('刷新状态'))
    await waitFor(() => expect(adminApi.getRun).toHaveBeenCalledWith(runA.runId, expect.anything()))
    const drawer = await screen.findByRole('dialog')
    expect(drawer.textContent).toContain('运行成功')
  })

  it('刷新失败时保留旧数据并明确标记', async () => {
    vi.mocked(adminApi.getRun)
      .mockResolvedValueOnce(runA)
      .mockRejectedValueOnce(new AdminApiError('TIMEOUT', '读取超时', 504))
    renderPage()
    fireEvent.click(await screen.findByText('供应商响应超时'))
    await screen.findByText('运行详情')
    fireEvent.click(await screen.findByText('刷新状态'))
    await screen.findByText('刷新失败，正在展示上次成功加载的数据')
    expect(screen.getAllByText('供应商响应超时').length).toBeGreaterThan(0)
  })

  it('快速切换记录时旧请求不得覆盖新记录', async () => {
    let finishA!: (row: RunRow) => void
    vi.mocked(adminApi.getRun).mockImplementation((runId: string) => {
      if (runId === runA.runId) {
        return new Promise((resolve) => {
          finishA = resolve
        })
      }
      return Promise.resolve(runB)
    })
    renderPage()
    await screen.findByText('供应商响应超时')
    fireEvent.click(screen.getByText('供应商响应超时'))
    fireEvent.click(await screen.findByText('另一条失败'))
    const drawer = await screen.findByRole('dialog')
    await waitFor(() => expect(drawer.textContent).toContain('另一条失败'))
    await act(async () => {
      finishA(runA)
    })
    expect(drawer.textContent).toContain('另一条失败')
    expect(drawer.textContent).not.toContain('供应商响应超时')
  })

  it('权限失效后清除不应继续展示的详情', async () => {
    vi.mocked(adminApi.getRun)
      .mockResolvedValueOnce(runA)
      .mockRejectedValueOnce(new AdminApiError('UNAUTHENTICATED', '缺少有效管理身份', 401))
    renderPage()
    fireEvent.click(await screen.findByText('供应商响应超时'))
    await screen.findByText('运行详情')
    fireEvent.click(await screen.findByText('刷新状态'))
    await waitFor(() => expect(screen.queryByText('运行详情')).toBeNull())
  })
})
