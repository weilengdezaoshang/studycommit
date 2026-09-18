import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminApiError, AdminClient } from '@/services/api-client'
import { validateLoginForm } from '@/services/login'
import { useCursorList } from '@/hooks/use-cursor-list'
import { buildDraftConfig, valuesFromConfig } from '@/pages/Campaigns/draft-form'
import type { CampaignDraftConfig } from '@/services/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('独立审查回归', () => {
  it('支持契约允许的中文管理员账号', () => {
    expect(validateLoginForm({ account: '运营管理员', password: 'password123' })).toEqual({})
  })

  it('非 JSON 的登录失效响应仍清理会话并保留状态码', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Unauthorized</html>', { status: 401 })),
    )
    const unauthorized = vi.fn()
    const api = new AdminClient({
      baseUrl: '',
      getToken: () => 'test-token',
      onUnauthorized: unauthorized,
    })
    await expect(api.get('/api/admin/overview')).rejects.toMatchObject({ status: 401 })
    expect(unauthorized).toHaveBeenCalledOnce()
  })

  it('编辑文案时保留已有活动领取资格', () => {
    const config: CampaignDraftConfig = {
      name: '内部规则名称',
      grantCredits: 100,
      creditValidityDays: 30,
      fixedExpiresAt: null,
      perUserLimit: 1,
      startsAt: '2026-09-18T00:00:00Z',
      endsAt: '2026-09-30T00:00:00Z',
      platforms: ['desktop'],
      eligibility: {
        verifiedFrom: '2026-09-01T00:00:00Z',
        verifiedTo: null,
        providers: ['account'],
        requireActiveAccount: true,
      },
      copy: { title: '对外标题', description: '原说明', successMessage: '已领取' },
    }
    const values = valuesFromConfig(config)
    values.description = '修改后的说明'
    const result = buildDraftConfig(values)
    expect(result.eligibility).toEqual(config.eligibility)
    expect(result.name).toBe(config.name)
    expect(result.copy.description).toBe('修改后的说明')
  })

  it('筛选改变后忽略旧请求的迟到结果', async () => {
    let completeOld!: (page: { items: string[]; nextCursor: null }) => void
    const fetchPage = vi.fn(
      ({ status }: { status: string; cursor: string | null; limit: number }) =>
        status === 'old'
          ? new Promise<{ items: string[]; nextCursor: null }>((resolve) => {
              completeOld = resolve
            })
          : Promise.resolve({ items: ['新筛选'], nextCursor: null }),
    )
    const oldFilters = { status: 'old' }
    const newFilters = { status: 'new' }
    const { result, rerender } = renderHook(
      ({ filters }) => useCursorList({ fetchPage, filters }),
      { initialProps: { filters: oldFilters } },
    )
    rerender({ filters: newFilters })
    await waitFor(() => expect(result.current.items).toEqual(['新筛选']))
    await act(async () => {
      completeOld({ items: ['旧筛选'], nextCursor: null })
    })
    expect(result.current.items).toEqual(['新筛选'])
  })

  it('下一页失败时保留当前页码并能重试同一游标', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: ['第一页'], nextCursor: 'next-a' })
      .mockRejectedValueOnce(new AdminApiError('UNAVAILABLE', '暂时不可用', 503))
      .mockResolvedValueOnce({ items: ['第二页'], nextCursor: null })
    const filters = {}
    const { result } = renderHook(() => useCursorList({ fetchPage, filters }))
    await waitFor(() => expect(result.current.items).toEqual(['第一页']))
    act(() => result.current.goNext())
    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.pageIndex).toBe(0)
    expect(result.current.items).toEqual(['第一页'])
    act(() => result.current.goNext())
    await waitFor(() => expect(result.current.items).toEqual(['第二页']))
    expect(fetchPage.mock.calls[2][0].cursor).toBe('next-a')
  })
})
