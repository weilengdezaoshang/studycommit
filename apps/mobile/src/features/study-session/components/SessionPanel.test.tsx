import { screen, userEvent } from '@testing-library/react-native'
import {
  completedStudySessionFixture,
  pausedStudySessionFixture,
  runningStudySessionFixture,
} from '@studycommit/common/contracts'
import { HttpError } from '@studycommit/common/http'
import { createStudySessionGateway, renderStudyApp } from '../test/render-study'

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

  it('requires confirmation before complete and does not mention a saved learning log', async () => {
    const user = userEvent.setup()
    const complete = jest.fn().mockResolvedValue(completedStudySessionFixture)
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
    expect(screen.getByLabelText('结束本次学习？')).toBeOnTheScreen()
    expect(complete).not.toHaveBeenCalled()
    await user.press(screen.getByRole('button', { name: '确认完成' }))
    expect(complete).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText('本次学习已结束。本阶段不会自动生成学习记录。'),
    ).toBeOnTheScreen()
    expect(screen.queryByText(/学习记录已保存/)).not.toBeOnTheScreen()
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
