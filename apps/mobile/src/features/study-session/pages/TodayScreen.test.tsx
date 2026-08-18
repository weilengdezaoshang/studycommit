import { screen, userEvent } from '@testing-library/react-native'
import {
  pausedStudySessionFixture,
  runningStudySessionFixture,
} from '@studycommit/common/contracts'
import { HttpError } from '@studycommit/common/http'
import { createStudySessionGateway, renderStudyApp } from '../test/render-study'

describe('TodayScreen', () => {
  it('shows the idle card when there is no active session', async () => {
    await renderStudyApp()
    expect(await screen.findByText('今天，从一次专注开始')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '开始学习' })).toBeEnabled()
    expect(screen.queryByLabelText('专题')).not.toBeOnTheScreen()
  })

  it('shows the running session timer instead of a continue card', async () => {
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: '2026-08-17T08:10:00.000Z',
        }),
      }),
    })
    expect(await screen.findByText('正在学习')).toBeOnTheScreen()
    expect(await screen.findByText('Electron 架构')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '暂停' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '继续学习' })).not.toBeOnTheScreen()
  })

  it('keeps the same session after visiting topics and returning to today', async () => {
    const user = userEvent.setup()
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: '2026-08-17T08:10:00.000Z',
        }),
      }),
    })
    expect(await screen.findByRole('button', { name: '暂停' })).toBeOnTheScreen()
    await user.press(screen.getByLabelText('专题，标签页'))
    expect(screen.getByText('整理你的知识专题')).toBeOnTheScreen()
    await user.press(screen.getByLabelText('今天，标签页'))
    expect(screen.getByRole('button', { name: '暂停' })).toBeEnabled()
    expect(screen.queryByLabelText('正在读取当前学习会话')).not.toBeOnTheScreen()
  })

  it('shows paused controls for a paused session', async () => {
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: pausedStudySessionFixture,
          serverNow: '2026-08-17T08:20:00.000Z',
        }),
      }),
    })
    expect(await screen.findByText('已暂停')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '继续' })).toBeEnabled()
  })

  it('shows a retryable error', async () => {
    let shouldFail = true
    const user = userEvent.setup()
    await renderStudyApp({
      studySessions: createStudySessionGateway({
        getActive: async () => {
          if (shouldFail) {
            throw new HttpError({
              code: 'NETWORK_ERROR',
              message: '网络不可用',
              status: null,
              backendCode: null,
              requestId: 'req-1',
              details: null,
            })
          }
          return { session: null, serverNow: '2026-08-17T08:00:00.000Z' }
        },
      }),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(/当前网络不可用/)
    shouldFail = false
    await user.press(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText('今天，从一次专注开始')).toBeOnTheScreen()
  })
})
