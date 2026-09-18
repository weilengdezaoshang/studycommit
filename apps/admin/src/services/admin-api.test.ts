import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminApi } from './admin-api'

describe('管理端列表请求', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('分页请求不发送会被严格数字契约拒绝的 limit 查询参数', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await adminApi.listCampaigns({ limit: 20, cursor: 'campaign-next' })
    await adminApi.listRuns({ limit: 20, cursor: 'run-next' })
    await adminApi.listAuditLogs({ limit: 20, cursor: 'audit-next' })
    await adminApi.listLedger({ limit: 50, cursor: 'ledger-next' })
    await adminApi.searchCreditUsers({ query: '林', limit: 20 })

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls).toEqual([
      '/api/admin/campaigns?cursor=campaign-next',
      '/api/admin/ai/runs?cursor=run-next',
      '/api/admin/audit-logs?cursor=audit-next',
      '/api/admin/credits/ledger?cursor=ledger-next',
      '/api/admin/credits/users?query=%E6%9E%97',
    ])
    expect(urls.every((url) => !url.includes('limit='))).toBe(true)
  })
})
