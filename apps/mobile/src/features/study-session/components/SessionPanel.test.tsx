import { screen, userEvent } from '@testing-library/react-native'
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
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
      }),
    })
    expect(await screen.findByRole('button', { name: '暂停' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '完成学习' })).toBeEnabled()
    expect(screen.getByLabelText('今天，标签页').props.accessibilityState).toEqual({
      selected: true,
    })
  })

  it('disables commands while a pause is in flight and then uses the response snapshot', async () => {
    const user = userEvent.setup()
    let finishPause: (session: typeof pausedStudySessionFixture) => void = () => undefined
    const pause = jest.fn(
      () =>
        new Promise<typeof pausedStudySessionFixture>((resolve) => {
          finishPause = resolve
        }),
    )
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
        pause,
      }),
    })
    await user.press(await screen.findByRole('button', { name: '暂停' }))
    expect(screen.getByRole('button', { name: '暂停' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '完成学习' })).toBeEnabled()
    finishPause(pausedStudySessionFixture)
    expect(await screen.findByRole('button', { name: '继续' })).toBeEnabled()
    expect(screen.getByText('已暂停')).toBeOnTheScreen()
  })

  it('collects the learning reflection before completing once', async () => {
    const user = userEvent.setup()
    const complete = jest.fn().mockResolvedValue(completeStudySessionResultFixture)
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
        complete,
      }),
    })
    await user.press(await screen.findByRole('button', { name: '完成学习' }))
    expect(screen.getByLabelText('完成本次学习')).toBeOnTheScreen()
    expect(screen.getByLabelText('学习收获')).toBeOnTheScreen()
    expect(complete).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('学习收获'), '理解了事务')
    await user.press(screen.getByRole('button', { name: '完成并保存' }))
    expect(complete).toHaveBeenCalledTimes(1)
    expect(complete.mock.calls[0]?.[0]).toMatchObject({
      gains: '理解了事务',
      problems: null,
      nextStep: null,
    })
    expect(await screen.findByText('本次学习已完成，学习记录已保存。')).toBeOnTheScreen()
    expect(screen.queryByLabelText('学习收获')).not.toBeOnTheScreen()
  })

  it('shows saved learning reflection as read-only after complete', async () => {
    const user = userEvent.setup()
    const completeWithLog = {
      ...completeStudySessionResultFixture,
      learningLog: { ...emptyLearningLogFixture, gains: '理解了事务' },
    }
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
        complete: jest.fn().mockResolvedValue(completeWithLog),
      }),
    })
    await user.press(await screen.findByRole('button', { name: '完成学习' }))
    await user.press(screen.getByRole('button', { name: '完成并保存' }))
    expect(await screen.findByText('理解了事务')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: '保存学习记录' })).not.toBeOnTheScreen()
  })

  it('keeps optional reflection fields empty without a second submit', async () => {
    const user = userEvent.setup()
    const complete = jest.fn().mockResolvedValue(completeStudySessionResultFixture)
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
        complete,
      }),
    })
    await user.press(await screen.findByRole('button', { name: '完成学习' }))
    expect(screen.getByRole('button', { name: '完成并保存' })).toBeEnabled()
    await user.press(screen.getByRole('button', { name: '完成并保存' }))
    expect(complete).toHaveBeenCalledTimes(1)
    expect(complete.mock.calls[0]?.[0]).toMatchObject({
      gains: null,
      problems: null,
      nextStep: null,
    })
  })

  it('retries complete after a timeout and uses the returned learning log', async () => {
    const user = userEvent.setup()
    const complete = jest
      .fn()
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(completeStudySessionResultFixture)
    const getById = jest.fn()
    const getBySession = jest.fn()
    await renderStudyApp({
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
    await user.press(await screen.findByRole('button', { name: '完成学习' }))
    await user.press(screen.getByRole('button', { name: '完成并保存' }))
    expect(await screen.findByText('本次学习已完成，学习记录已保存。')).toBeOnTheScreen()
    expect(complete).toHaveBeenCalledTimes(2)
    expect(complete.mock.calls[0]?.[0].idempotencyKey).toBe(
      complete.mock.calls[1]?.[0].idempotencyKey,
    )
    expect(getById).not.toHaveBeenCalled()
    expect(getBySession).not.toHaveBeenCalled()
  })

  it('shows a global toast when complete fails', async () => {
    const user = userEvent.setup()
    const complete = jest.fn().mockRejectedValue(
      new HttpError({
        code: 'INVALID_RESPONSE',
        message: '响应内容与契约不符',
        status: 201,
        backendCode: null,
        requestId: null,
        details: null,
      }),
    )
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
        complete,
      }),
    })
    await user.press(await screen.findByRole('button', { name: '完成学习' }))
    await user.press(screen.getByRole('button', { name: '完成并保存' }))
    expect(complete).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('服务返回了无法识别的数据。')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '暂停' })).toBeOnTheScreen()
  })

  it('refreshes from a version conflict without retrying the original command', async () => {
    const user = userEvent.setup()
    const pause = jest.fn().mockRejectedValue(
      new HttpError({
        code: 'CONFLICT',
        message: '学习会话版本冲突',
        status: 409,
        backendCode: 'SESSION_VERSION_CONFLICT',
        requestId: null,
        details: { session: pausedStudySessionFixture },
      }),
    )
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: runningStudySessionFixture.updatedAt,
        }),
        pause,
      }),
    })
    await user.press(await screen.findByRole('button', { name: '暂停' }))
    expect(await screen.findByRole('button', { name: '继续' })).toBeOnTheScreen()
    expect(screen.getByText('已暂停')).toBeOnTheScreen()
    expect(pause).toHaveBeenCalledTimes(1)
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
