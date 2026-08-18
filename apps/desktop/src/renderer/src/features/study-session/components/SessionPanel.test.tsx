import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  completedStudySessionFixture,
  pausedStudySessionFixture,
  runningStudySessionFixture,
} from '@studycommit/common/contracts'
import { HttpError } from '@studycommit/common/http'
import { createStudySessionGateway, renderStudyApp } from '../test/render-study'

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

  it('requires confirmation before complete and does not mention a saved learning log', async () => {
    const complete = vi.fn().mockResolvedValue(completedStudySessionFixture)
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
    expect(screen.getByRole('dialog', { name: '结束本次学习？' })).toBeInTheDocument()
    expect(complete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '确认完成' }))
    expect(complete).toHaveBeenCalledOnce()
    expect(
      await screen.findByText('本次学习已结束。本阶段不会自动生成学习记录。'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/学习记录已保存/)).not.toBeInTheDocument()
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
