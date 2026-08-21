import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  completeStudySessionResultFixture,
  emptyLearningLogFixture,
  pausedStudySessionFixture,
  runningStudySessionFixture,
} from '@studycommit/common/contracts'
import { HttpError } from '@studycommit/common/http'
import {
  createLearningLogGateway,
  createStudySessionGateway,
  renderStudyApp,
} from '../test/render-study'

describe('SessionPanel on today', () => {
  it('shows pause while running', async () => {
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
      }),
    })
    expect(await screen.findByRole('button', { name: '暂停' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '完成学习' })).toBeEnabled()
    expect(screen.getByRole('link', { name: '今天' })).toHaveAttribute('aria-current', 'page')
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

  it('confirms complete without notes then edits the learning log', async () => {
    const complete = vi.fn().mockResolvedValue(completeStudySessionResultFixture)
    const update = vi.fn().mockResolvedValue({
      ...emptyLearningLogFixture,
      gains: '理解了事务',
      version: 2,
    })
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
        complete,
      }),
      learningLogs: createLearningLogGateway({ update }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    expect(screen.getByRole('dialog', { name: '结束本次学习？' })).toBeInTheDocument()
    expect(screen.queryByLabelText('学习收获')).not.toBeInTheDocument()
    expect(complete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '确认完成' }))
    expect(complete).toHaveBeenCalledOnce()
    expect(
      await screen.findByText('本次学习已结束。可以补充收获、问题和下一步。'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('学习收获')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('学习收获'), '理解了事务')
    await userEvent.click(screen.getByRole('button', { name: '保存学习记录' }))
    expect(update).toHaveBeenCalledOnce()
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      id: emptyLearningLogFixture.id,
      version: 1,
      gains: '理解了事务',
    })
  })

  it('shows character counts and ignores whitespace-only learning log edits', async () => {
    const complete = vi.fn().mockResolvedValue(completeStudySessionResultFixture)
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
        complete,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '确认完成' }))
    expect(await screen.findByRole('button', { name: '保存学习记录' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('学习收获'), '   ')
    expect(screen.getByRole('button', { name: '保存学习记录' })).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('学习收获'))
    await userEvent.type(screen.getByLabelText('学习收获'), '理解了事务')
    expect(screen.getByText('5/10000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存学习记录' })).toBeEnabled()
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
        }),
        complete,
        getById,
      }),
      learningLogs: createLearningLogGateway({ getBySession }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '确认完成' }))
    expect(
      await screen.findByText('本次学习已结束。可以补充收获、问题和下一步。'),
    ).toBeInTheDocument()
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
        }),
        complete,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '确认完成' }))
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
        }),
        complete,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '确认完成' }))
    expect(await screen.findByRole('status')).toHaveTextContent('服务返回了无法识别的数据。')
    await userEvent.click(screen.getByRole('button', { name: '完成学习' }))
    await userEvent.click(screen.getByRole('button', { name: '确认完成' }))
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
