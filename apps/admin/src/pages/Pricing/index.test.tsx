import { App, ConfigProvider } from 'antd'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PricingPage from './index'
import { adminApi } from '@/services/admin-api'
import { queryClient } from '@/services/query-client'

vi.mock('@/services/admin-api', () => ({
  adminApi: {
    getAiConfig: vi.fn(),
    listPrices: vi.fn(),
    getAiProvider: vi.fn(),
    publishPrice: vi.fn(),
    updateAiConfig: vi.fn(),
  },
}))

afterEach(() => {
  cleanup()
  queryClient.clear()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(adminApi.getAiConfig).mockResolvedValue({
    aiEnabled: true,
    featureFlags: { paper_explain: true },
    costProtectionEnabled: true,
    dailyCostBudget: '500.0000',
    version: 8,
    updatedAt: '2026-09-18T10:32:00+08:00',
  })
  vi.mocked(adminApi.getAiProvider).mockResolvedValue({
    displayStatus: 'configured_unverified',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'provider-default',
    hasApiKey: true,
    apiKeyHint: '••••test',
    lastTestStatus: 'unverified',
    lastTestedAt: null,
    billedModel: 'active-model',
    envFallbackActive: false,
    version: 2,
    updatedAt: '2026-09-18T10:32:00+08:00',
  })
  vi.mocked(adminApi.listPrices).mockResolvedValue({
    items: [
      {
        id: '99999999-9999-4999-8999-999999999999',
        action: 'paper_explain',
        version: 3,
        priceCredits: 5,
        configSnapshot: {
          model: 'active-model',
          maxInputTokens: 20000,
          maxOutputTokens: 4000,
          estimatedCostPerRun: '0.010000',
          currency: 'CNY',
        },
        isActive: true,
        publishedAt: '2026-09-18T09:00:00+08:00',
        createdAt: '2026-09-18T09:00:00+08:00',
      },
    ],
  })
})

describe('PricingPage', () => {
  it('已有价格时发布新模型，提交使用本次表单模型而不是强制沿用生效价格', async () => {
    vi.mocked(adminApi.publishPrice).mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      action: 'paper_explain',
      version: 4,
      priceCredits: 8,
      configSnapshot: {
        model: 'new-billed-model',
        maxInputTokens: 20000,
        maxOutputTokens: 4000,
        estimatedCostPerRun: '0.020000',
        currency: 'CNY',
      },
      isActive: true,
      publishedAt: '2026-09-18T11:00:00+08:00',
      createdAt: '2026-09-18T11:00:00+08:00',
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ConfigProvider button={{ autoInsertSpace: false }}>
          <App>
            <PricingPage />
          </App>
        </ConfigProvider>
      </QueryClientProvider>,
    )
    await screen.findAllByText('价格版本 v3')
    const publishButton = await screen.findByRole('button', { name: '发布新价格' })
    await waitFor(() => expect((publishButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(publishButton)
    const dialog = await screen.findByRole('dialog')
    const modelInput = await waitFor(() => {
      const input = dialog.querySelector('#price-model') as HTMLInputElement | null
      if (!input) {
        throw new Error('模型输入未渲染')
      }
      return input
    })
    expect(modelInput.value).toBe('active-model')
    expect(modelInput.disabled).toBe(false)
    fireEvent.change(modelInput, { target: { value: 'new-billed-model' } })
    const creditsInput = dialog.querySelector('#price-credits') as HTMLInputElement
    fireEvent.change(creditsInput, { target: { value: '8' } })
    fireEvent.blur(creditsInput)
    const costInput = dialog.querySelector('#price-cost') as HTMLInputElement
    fireEvent.change(costInput, { target: { value: '0.020000' } })
    expect(screen.getByText(/计费模型将从 active-model 更换为 new-billed-model/)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('请输入操作理由'), {
      target: { value: '更换计费模型' },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认发布' }))
    await waitFor(() => expect(adminApi.publishPrice).toHaveBeenCalled())
    expect(vi.mocked(adminApi.publishPrice).mock.calls[0][0].configSnapshot.model).toBe(
      'new-billed-model',
    )
  }, 15000)
})
