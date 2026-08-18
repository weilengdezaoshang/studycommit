import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HttpError } from '@studycommit/common/http'
import {
  pausedStudySessionFixture,
  runningStudySessionFixture,
} from '@studycommit/common/contracts'
import { createStudySessionGateway, renderStudyApp } from '../test/render-study'

describe('TodayPage', () => {
  it('shows the idle card when there is no active session', async () => {
    renderStudyApp('/today')
    expect(screen.getByText('正在读取当前学习会话')).toBeInTheDocument()
    expect(await screen.findByText('今天，从一次专注开始')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始学习' })).toBeEnabled()
    expect(screen.queryByLabelText('专题')).not.toBeInTheDocument()
  })

  it('shows the running session timer instead of a continue card', async () => {
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: '2026-08-17T08:10:00.000Z',
        }),
      }),
    })
    expect(await screen.findByText('正在学习')).toBeInTheDocument()
    expect(await screen.findByText('Electron 架构')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '暂停' })).toBeEnabled()
    expect(screen.queryByRole('link', { name: '继续学习' })).not.toBeInTheDocument()
  })

  it('keeps the same session after visiting topics and returning to today', async () => {
    const user = userEvent.setup()
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: '2026-08-17T08:10:00.000Z',
        }),
      }),
    })
    expect(await screen.findByRole('button', { name: '暂停' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '所有专题' }))
    expect(screen.getByText('还没有专题')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '今天' }))
    expect(screen.getByRole('button', { name: '暂停' })).toBeEnabled()
    expect(screen.queryByText('正在读取当前学习会话')).not.toBeInTheDocument()
  })

  it('shows paused controls for a paused session', async () => {
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: pausedStudySessionFixture,
          serverNow: '2026-08-17T08:20:00.000Z',
        }),
      }),
    })
    expect(await screen.findByText('已暂停')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续' })).toBeEnabled()
  })

  it('shows a retryable error', async () => {
    let shouldFail = true
    renderStudyApp('/today', {
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
    expect(await screen.findByRole('alert')).toHaveTextContent('当前网络不可用')
    shouldFail = false
    await userEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText('今天，从一次专注开始')).toBeInTheDocument()
  })
})
