import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  completeStudySessionResultFixture,
  pausedStudySessionFixture,
  runningStudySessionFixture,
} from '@studycommit/common/contracts'
import { HttpError } from '@studycommit/common/http'
import {
  createLearningLogGateway,
  createStudySessionGateway,
  renderStudyApp,
} from '../test/render-study'

/** 带关联纸页的运行中会话:收尾走回写理解对话框(C04)。 */
function runningPaperSessionFixture() {
  return {
    ...runningStudySessionFixture,
    paperId: 'a4c9d2e1-3333-4333-8333-333333333390',
  }
}

describe('SessionPanel on today', () => {
  it('收尾回写理解时可展开参考片段', async () => {
    const user = userEvent.setup()
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningPaperSessionFixture(),
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        listFragments: async () => [
          {
            id: '8a1b2c3d-1111-4111-8111-111111111111',
            userId: '22222222-2222-4222-8222-222222222222',
            paperId: 'a4c9d2e1-3333-4333-8333-333333333390',
            sessionId: '11111111-1111-4111-8111-111111111111',
            content: '片段一：先跑通主流程再谈优化',
            position: 0,
            version: 1,
            createdAt: '2026-08-17T08:05:00.000Z',
            updatedAt: '2026-08-17T08:05:00.000Z',
          },
        ],
      }),
    })

    await user.click(await screen.findByRole('button', { name: '完成学习' }))
    await user.click(screen.getByText('参考已记的片段'))

    // 片段同时出现在输入区与参考列表中
    expect(
      (await screen.findAllByText('片段一：先跑通主流程再谈优化')).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('还有待同步片段时收尾被拦截且不调用完成', async () => {
    const complete = vi.fn().mockResolvedValue(completeStudySessionResultFixture)
    const completePaper = vi.fn()
    const user = userEvent.setup()
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningPaperSessionFixture(),
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        pendingFragmentCount: async () => 2,
        complete,
        completePaper,
      }),
    })

    await user.click(await screen.findByRole('button', { name: '完成学习' }))
    await user.type(await screen.findByLabelText('这次弄懂了什么（必填）'), '弄懂了')
    await user.click(screen.getByRole('button', { name: '完成并回写' }))

    expect(await screen.findByText(/还有 2 条片段未同步/)).toBeInTheDocument()
    expect(completePaper).not.toHaveBeenCalled()
  })

  it('参考片段读取失败时给出说明且不妨碍收尾', async () => {
    const user = userEvent.setup()
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningPaperSessionFixture(),
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        listFragments: async () => {
          throw new Error('offline')
        },
      }),
    })

    await user.click(await screen.findByRole('button', { name: '完成学习' }))
    await user.click(screen.getByText('参考已记的片段'))

    expect(await screen.findByText('片段暂时读不出来，不影响收尾。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完成并回写' })).toBeEnabled()
  })

  it('shows pause while running', async () => {
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
      }),
    })
    expect(await screen.findByRole('button', { name: '暂停' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '完成学习' })).toBeEnabled()
  })

  it('disables commands while a pause is in flight and then uses the response snapshot', async () => {
    let finishPause: (session: typeof pausedStudySessionFixture) => void = () => undefined
    const pause = vi.fn(
      () =>
        new Promise<typeof pausedStudySessionFixture>((resolve) => {
          finishPause = resolve
        }),
    )
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        pause,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '暂停' }))
    expect(screen.getByRole('button', { name: '暂停' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '完成学习' })).toBeEnabled()
    finishPause(pausedStudySessionFixture)
    expect(await screen.findByRole('button', { name: '继续' })).toBeEnabled()
    expect(screen.getByText('已暂停')).toBeInTheDocument()
  })

  it('collects the learning reflection before completing once', async () => {
    const complete = vi.fn().mockResolvedValue(completeStudySessionResultFixture)
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        complete,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    expect(screen.getByRole('dialog', { name: '完成本次学习' })).toBeInTheDocument()
    expect(screen.getByLabelText('学习收获')).toBeInTheDocument()
    expect(complete).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('学习收获'), '理解了事务')
    await userEvent.click(screen.getByRole('button', { name: '完成并保存' }))
    expect(complete).toHaveBeenCalledOnce()
    expect(complete.mock.calls[0]?.[0]).toMatchObject({
      gains: '理解了事务',
      problems: null,
      nextStep: null,
    })
    expect(await screen.findByText('本次学习已完成，学习记录已保存。')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('学习收获')).not.toBeInTheDocument()
  })

  it('completes with one submit when optional reflections are empty', async () => {
    const complete = vi.fn().mockResolvedValue(completeStudySessionResultFixture)
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        complete,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '完成并保存' }))
    expect(complete).toHaveBeenCalledOnce()
    expect(complete.mock.calls[0]?.[0]).toMatchObject({
      gains: null,
      problems: null,
      nextStep: null,
    })
    expect(screen.queryByLabelText('学习收获')).not.toBeInTheDocument()
  })

  it('retries complete after a timeout and uses the returned learning log', async () => {
    const complete = vi
      .fn()
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(completeStudySessionResultFixture)
    const getById = vi.fn()
    const getBySession = vi.fn()
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        complete,
        getById,
      }),
      learningLogs: createLearningLogGateway({ getBySession }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '完成并保存' }))
    expect(await screen.findByText('本次学习已完成，学习记录已保存。')).toBeInTheDocument()
    expect(complete).toHaveBeenCalledTimes(2)
    expect(complete.mock.calls[0]?.[0].idempotencyKey).toBe(
      complete.mock.calls[1]?.[0].idempotencyKey,
    )
    expect(getById).not.toHaveBeenCalled()
    expect(getBySession).not.toHaveBeenCalled()
  })

  it('shows a global toast when complete fails', async () => {
    const complete = vi.fn().mockRejectedValue(
      new HttpError({
        code: 'INVALID_RESPONSE',
        message: '响应内容与契约不符',
        status: 201,
        backendCode: null,
        requestId: null,
        details: null,
      }),
    )
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        complete,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '完成并保存' }))
    expect(complete).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('服务返回了无法识别的数据。')
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument()
  })

  it('uses a new complete key after a visible failure', async () => {
    const complete = vi
      .fn()
      .mockRejectedValueOnce(
        new HttpError({
          code: 'INVALID_RESPONSE',
          message: '响应内容与契约不符',
          status: 201,
          backendCode: null,
          requestId: null,
          details: null,
        }),
      )
      .mockResolvedValueOnce(completeStudySessionResultFixture)
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        complete,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '完成并保存' }))
    expect(await screen.findByRole('status')).toHaveTextContent('服务返回了无法识别的数据。')
    await userEvent.click(screen.getByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '完成并保存' }))
    expect(complete).toHaveBeenCalledTimes(2)
    expect(complete.mock.calls[0]?.[0].idempotencyKey).not.toBe(
      complete.mock.calls[1]?.[0].idempotencyKey,
    )
  })

  it('refreshes from a version conflict without retrying the original command', async () => {
    const pause = vi.fn().mockRejectedValue(
      new HttpError({
        code: 'CONFLICT',
        message: '学习会话版本冲突',
        status: 409,
        backendCode: 'SESSION_VERSION_CONFLICT',
        requestId: null,
        details: { session: pausedStudySessionFixture },
      }),
    )
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
          paper: null,
        }),
        pause,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '暂停' }))
    expect(await screen.findByRole('button', { name: '继续' })).toBeInTheDocument()
    expect(screen.getByText('已暂停')).toBeInTheDocument()
    expect(pause).toHaveBeenCalledOnce()
  })
})

function timeoutError() {
  return new HttpError({
    code: 'TIMEOUT',
    message: '请求超时',
    status: null,
    backendCode: null,
    requestId: null,
    details: null,
  })
}
