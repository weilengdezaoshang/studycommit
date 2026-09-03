import { describe, expect, it, vi } from 'vitest'
import { AiService } from './ai.service'

function buildService(provider: unknown) {
  const repository = {
    createFollowupRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
    completeFollowupRun: vi.fn().mockResolvedValue(undefined),
    failRun: vi.fn().mockResolvedValue(undefined),
    confirmRun: vi.fn().mockResolvedValue(undefined),
  }
  const config = { get: vi.fn() }
  const service = new AiService(repository as never, config as never, provider as never)
  return { service, repository }
}

const input = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  topicId: null,
  expression: 'React 批处理会把多次更新合并成一次渲染。',
}

describe('AiService', () => {
  it('供应商输出合法 JSON 时返回追问并记录完成状态', async () => {
    const { service, repository } = buildService({
      model: 'test-model',
      complete: vi.fn().mockResolvedValue({
        text: '{"questions":[{"question":"为什么批处理是必要的?"}],"memoryDraft":{"summary":"合并更新","gap":"没讲调度时机"}}',
        model: 'test-model',
      }),
    })

    const output = await service.generateCompanionFollowup('user-1', input)

    expect(output.questions).toHaveLength(1)
    expect(output.promptVersion).toBe('companion-followup@1')
    expect(output.model).toBe('test-model')
    expect(repository.createFollowupRun).toHaveBeenCalledWith(
      'user-1',
      input,
      'companion-followup@1',
    )
    expect(repository.completeFollowupRun).toHaveBeenCalledWith('run-1', output)
    expect(repository.failRun).not.toHaveBeenCalled()
  })

  it('输出不是 JSON 时抛出输出无效并记录失败', async () => {
    const { service, repository } = buildService({
      model: 'test-model',
      complete: vi.fn().mockResolvedValue({ text: '抱歉,我不能这样回答', model: 'test-model' }),
    })

    await expect(service.generateCompanionFollowup('user-1', input)).rejects.toMatchObject({
      response: { code: 'AI_OUTPUT_INVALID' },
    })
    expect(repository.failRun).toHaveBeenCalledWith(
      'run-1',
      expect.any(String),
      'companion-followup@1',
    )
    expect(repository.completeFollowupRun).not.toHaveBeenCalled()
  })

  it('未配置供应商时直接返回不可用且不落库', async () => {
    const { service, repository } = buildService(null)

    await expect(service.generateCompanionFollowup('user-1', input)).rejects.toMatchObject({
      response: { code: 'AI_UNAVAILABLE' },
    })
    expect(repository.createFollowupRun).not.toHaveBeenCalled()
  })
})
