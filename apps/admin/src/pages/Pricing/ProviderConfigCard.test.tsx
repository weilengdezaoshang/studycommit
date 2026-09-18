import { App, ConfigProvider } from 'antd'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderConfigCard } from './ProviderConfigCard'
import { adminApi } from '@/services/admin-api'
import { queryClient } from '@/services/query-client'
import { AdminApiError } from '@/services/api-client'
import type { AiProviderConfig, AiProviderTestResult } from '@/services/types'

vi.mock('@/services/admin-api', () => ({
  adminApi: {
    getAiProvider: vi.fn(),
    updateAiProvider: vi.fn(),
    disableAiProvider: vi.fn(),
    testAiProvider: vi.fn(),
    getAiProviderOperation: vi.fn(),
  },
}))

const config: AiProviderConfig = {
  displayStatus: 'configured_unverified',
  protocol: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-test',
  hasApiKey: true,
  apiKeyHint: '••••test',
  lastTestStatus: 'unverified',
  lastTestedAt: null,
  billedModel: 'active-model',
  envFallbackActive: false,
  version: 2,
  lastOperationId: '11111111-1111-4111-8111-111111111111',
  updatedAt: '2026-09-18T00:00:00Z',
}

function renderCard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfigProvider button={{ autoInsertSpace: false }}>
        <App>
          <ProviderConfigCard />
        </App>
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

async function openForm() {
  await screen.findByRole('button', { name: '更换配置' })
  fireEvent.click(screen.getByRole('button', { name: '更换配置' }))
  await screen.findByText('保存服务商配置')
}

afterEach(() => {
  cleanup()
  queryClient.clear()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(adminApi.getAiProvider).mockResolvedValue(config)
})

describe('ProviderConfigCard', () => {
  it('测试中修改表单后，旧请求返回不得更新当前测试状态', async () => {
    let finish!: (value: AiProviderTestResult) => void
    vi.mocked(adminApi.testAiProvider).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    renderCard()
    await openForm()
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'changed-model' } })
    await act(async () => {
      finish({
        ok: true,
        code: 'connected',
        message: '连接成功',
        testedAt: '2026-09-18T00:00:00Z',
        persisted: false,
      })
    })
    expect(screen.queryByText('连接成功')).toBeNull()
  })

  it('关闭弹窗再打开后，旧测试结果不得显示', async () => {
    let finish!: (value: AiProviderTestResult) => void
    vi.mocked(adminApi.testAiProvider).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    renderCard()
    await openForm()
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(screen.getByRole('button', { name: '更换配置' }))
    await screen.findByText('保存服务商配置')
    await act(async () => {
      finish({
        ok: true,
        code: 'connected',
        message: '连接成功',
        testedAt: '2026-09-18T00:00:00Z',
        persisted: false,
      })
    })
    expect(screen.queryByText('连接成功')).toBeNull()
  })

  it('多次测试乱序返回时只展示最后一次被测配置的结果', async () => {
    const pending: Array<(value: AiProviderTestResult) => void> = []
    vi.mocked(adminApi.testAiProvider).mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve)
        }),
    )
    renderCard()
    await openForm()
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'model-a' } })
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    await waitFor(() => expect(pending).toHaveLength(1))
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'model-b' } })
    fireEvent.click(screen.getByRole('button', { name: /测试/ }))
    await waitFor(() => expect(pending).toHaveLength(2))
    await act(async () => {
      pending[1]({
        ok: true,
        code: 'connected',
        message: '连接成功',
        testedAt: '2026-09-18T00:00:02Z',
        persisted: false,
      })
    })
    await screen.findByText('连接成功')
    await act(async () => {
      pending[0]({
        ok: false,
        code: 'failed',
        message: '连接失败',
        testedAt: '2026-09-18T00:00:01Z',
        persisted: false,
      })
    })
    expect(screen.getByText('连接成功')).toBeTruthy()
    expect(screen.queryByText('连接失败')).toBeNull()
  })

  it('请求结束触发配置刷新时不得覆盖用户已经修改的表单', async () => {
    vi.mocked(adminApi.testAiProvider).mockResolvedValue({
      ok: true,
      code: 'connected',
      message: '连接成功',
      testedAt: '2026-09-18T00:00:00Z',
      persisted: true,
    })
    vi.mocked(adminApi.getAiProvider)
      .mockResolvedValueOnce(config)
      .mockResolvedValue({ ...config, model: 'server-model' })
    renderCard()
    await openForm()
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'draft-model' } })
    fireEvent.click(screen.getByRole('button', { name: /测试连接/ }))
    await screen.findByText('连接成功')
    await waitFor(() =>
      expect(vi.mocked(adminApi.getAiProvider).mock.calls.length).toBeGreaterThan(1),
    )
    expect((screen.getByLabelText('模型') as HTMLInputElement).value).toBe('draft-model')
  })

  it('仅更换 Key 且写入未成功时不得提示保存成功', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as ReturnType<typeof crypto.randomUUID>,
    )
    vi.mocked(adminApi.updateAiProvider).mockRejectedValue(new Error('network down'))
    vi.mocked(adminApi.getAiProviderOperation).mockRejectedValue(
      new AdminApiError('AI_PROVIDER_OPERATION_NOT_FOUND', '未查询到该服务商配置操作', 404),
    )
    renderCard()
    await openForm()
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-new-not-real' } })
    fireEvent.change(screen.getByPlaceholderText('请输入操作理由'), {
      target: { value: '只更换密钥' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(screen.getAllByText('操作结果待确认').length).toBeGreaterThan(0))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getAllByRole('button', { name: /查询结果/ })[0])
    await waitFor(() =>
      expect(adminApi.getAiProviderOperation).toHaveBeenCalledWith(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
    )
    expect(screen.queryByText('本次保存已成功')).toBeNull()
    expect(screen.getAllByText(/尚未查询到本次保存的操作记录/).length).toBeGreaterThan(0)
  })

  it('写入成功但响应丢失后按操作标识确认，被覆盖时区分本次保存与当前配置', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as ReturnType<typeof crypto.randomUUID>,
    )
    vi.mocked(adminApi.updateAiProvider).mockRejectedValue(new Error('timeout'))
    vi.mocked(adminApi.getAiProviderOperation).mockResolvedValue({
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'save',
      protocol: 'openai',
      baseUrl: config.baseUrl,
      model: 'gpt-test',
      keyChanged: true,
      versionAfter: 3,
      currentVersion: 4,
      isCurrent: false,
      createdAt: '2026-09-18T00:00:00Z',
    })
    renderCard()
    await openForm()
    fireEvent.change(screen.getByPlaceholderText('请输入操作理由'), {
      target: { value: '更换密钥后超时' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(screen.getAllByText('操作结果待确认').length).toBeGreaterThan(0))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /查询结果/ }))
    await waitFor(() =>
      expect(
        screen.queryByText('本次保存已成功，但当前配置已被后续操作覆盖。请查看最新配置。'),
      ).not.toBeNull(),
    )
  })
})
