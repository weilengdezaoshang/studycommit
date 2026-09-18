import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiBillingService } from './ai-billing.service'

describe('AiBillingService', () => {
  const repository = {
    findRunWithReservation: vi.fn(),
    transaction: vi.fn(),
    casCompleteRunInTx: vi.fn(),
    findReservationByRunId: vi.fn(),
  }
  const credits = {
    settleInTx: vi.fn(),
  }
  const aiConfigRepository = {
    listPrices: vi.fn(),
  }
  const ai = {
    completeExplain: vi.fn(),
    parseExplainOutput: vi.fn(),
  }
  const logger = {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
  let service: AiBillingService

  beforeEach(() => {
    vi.clearAllMocks()
    repository.transaction.mockImplementation(async (work: (tx: unknown) => unknown) => work({}))
    service = new AiBillingService(
      repository as never,
      credits as never,
      aiConfigRepository as never,
      ai as never,
      logger as never,
    )
  })

  it('已有价格时发布新模型，历史运行仍使用原价格快照中的模型', async () => {
    repository.findRunWithReservation.mockResolvedValue({
      run: {
        id: '55555555-5555-4555-8555-555555555555',
        status: 'pending',
        priceVersion: 1,
        input: { content: '解释闭包', directive: 'initial', round: 1 },
        createdAt: new Date('2026-09-18T00:00:00.000Z'),
      },
      reservation: { id: 'res-1', status: 'active' },
    })
    aiConfigRepository.listPrices.mockResolvedValue([
      {
        version: 1,
        configSnapshot: { model: 'old-model', estimatedCostPerRun: '0.010000' },
        isActive: false,
      },
      {
        version: 2,
        configSnapshot: { model: 'new-model', estimatedCostPerRun: '0.020000' },
        isActive: true,
      },
    ])
    ai.completeExplain.mockResolvedValue({
      text: '{"view":{"type":"causal_chain"}}',
      model: 'old-model',
    })
    ai.parseExplainOutput.mockReturnValue({ view: { type: 'causal_chain' } })
    repository.casCompleteRunInTx.mockResolvedValue(false)

    await service.executeRun('55555555-5555-4555-8555-555555555555')

    expect(ai.completeExplain).toHaveBeenCalledWith(
      { content: '解释闭包', directive: 'initial', round: 1 },
      undefined,
      { modelOverride: 'old-model' },
    )
    expect(ai.completeExplain.mock.calls[0][2].modelOverride).not.toBe('new-model')
  })
})
