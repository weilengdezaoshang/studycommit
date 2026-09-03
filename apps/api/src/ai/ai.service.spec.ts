import { describe, expect, it, vi } from 'vitest'
import { AiService } from './ai.service'

function buildService(provider: unknown) {
  const repository = {
    createExplainRun: vi.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' }),
    completeExplainRun: vi.fn().mockResolvedValue(undefined),
    failRun: vi.fn().mockResolvedValue(undefined),
    confirmRun: vi.fn().mockResolvedValue(true),
  }
  const config = { get: vi.fn() }
  const service = new AiService(repository as never, config as never, provider as never)
  return { service, repository }
}

const input = {
  paperId: '11111111-1111-4111-8111-111111111111',
  content: 'React 的批处理会把多次 setState 合并成一次渲染。',
  questionText: null,
  directive: 'initial' as const,
  round: 1,
}

describe('AiService', () => {
  it('供应商输出合法 JSON 时返回解释卡并记录完成状态', async () => {
    const { service, repository } = buildService({
      model: 'test-model',
      complete: vi.fn().mockResolvedValue({
        text: '{"view":{"type":"causal_chain","steps":[{"title":"连续调用","detail":"多次 setState 进队"},{"title":"统一处理","detail":"事件结束后一次渲染"}]},"example":"连续点三次按钮只重渲染一次","plainLevel":1}',
        model: 'test-model',
      }),
    })

    const output = await service.generatePaperExplain('user-1', input)

    expect(output.view.type).toBe('causal_chain')
    expect(output.promptVersion).toBe('paper-explain@1')
    expect(output.model).toBe('test-model')
    expect(repository.createExplainRun).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ directive: 'initial' }),
      'paper-explain@1',
    )
    expect(repository.completeExplainRun).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      output,
    )
    expect(repository.failRun).not.toHaveBeenCalled()
  })

  it('输出不是 JSON 时抛出输出无效并记录失败', async () => {
    const { service, repository } = buildService({
      model: 'test-model',
      complete: vi.fn().mockResolvedValue({ text: '抱歉,我不能这样回答', model: 'test-model' }),
    })

    await expect(service.generatePaperExplain('user-1', input)).rejects.toMatchObject({
      response: { code: 'AI_OUTPUT_INVALID' },
    })
    expect(repository.failRun).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.any(String),
      'paper-explain@1',
    )
    expect(repository.completeExplainRun).not.toHaveBeenCalled()
  })

  it('未配置供应商时直接返回不可用且不落库', async () => {
    const { service, repository } = buildService(null)

    await expect(service.generatePaperExplain('user-1', input)).rejects.toMatchObject({
      response: { code: 'AI_UNAVAILABLE' },
    })
    expect(repository.createExplainRun).not.toHaveBeenCalled()
  })

  it('确认解释卡时仅返回当前用户的确认结果', async () => {
    const { service, repository } = buildService(null)
    await expect(
      service.confirmPaperExplain('user-1', '11111111-1111-4111-8111-111111111111'),
    ).resolves.toEqual({ confirmed: true })
    expect(repository.confirmRun).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'user-1',
    )
  })
})
