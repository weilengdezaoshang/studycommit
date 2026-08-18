import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { activeTopicFixture, runningStudySessionFixture } from '@studycommit/common/contracts'
import { HttpError } from '@studycommit/common/http'
import { createStudySessionGateway, createTopicGateway, renderStudyApp } from '../test/render-study'

describe('StartStudyPanel', () => {
  it('loads topics, keeps labels visible, and blocks submit without a topic', async () => {
    renderStudyApp('/today')
    await userEvent.click(await screen.findByRole('button', { name: '开始学习' }))
    expect(await screen.findByLabelText('专题')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '今天' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('学习目标')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始学习' })).toBeDisabled()
    expect(screen.getByText('请选择一个专题后再开始。')).toBeInTheDocument()
  })

  it('shows a path to topics when none exist', async () => {
    renderStudyApp('/today', {
      topics: createTopicGateway({
        listActive: async () => ({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '开始学习' }))
    expect(await screen.findByRole('link', { name: '前往专题' })).toHaveAttribute('href', '/topics')
  })

  it('creates a session once and stays on today with timer controls', async () => {
    const create = vi.fn().mockResolvedValue(runningStudySessionFixture)
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({ create }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '开始学习' }))
    await userEvent.selectOptions(await screen.findByLabelText('专题'), activeTopicFixture.id)
    await userEvent.type(screen.getByLabelText('学习目标'), '理解 IPC')
    await userEvent.click(screen.getByRole('button', { name: '开始学习' }))
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      topicId: activeTopicFixture.id,
      goal: '理解 IPC',
    })
    expect(await screen.findByRole('button', { name: '暂停' })).toBeInTheDocument()
  })

  it('enters the existing session when create conflicts', async () => {
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({
        create: async () => {
          throw new HttpError({
            code: 'CONFLICT',
            message: '当前已有进行中的学习会话',
            status: 409,
            backendCode: 'ACTIVE_STUDY_SESSION_EXISTS',
            requestId: null,
            details: { sessionId: runningStudySessionFixture.id, status: 'running' },
          })
        },
        getById: async () => runningStudySessionFixture,
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '开始学习' }))
    await userEvent.selectOptions(await screen.findByLabelText('专题'), activeTopicFixture.id)
    await userEvent.click(screen.getByRole('button', { name: '开始学习' }))
    expect(await screen.findByRole('button', { name: '暂停' })).toBeInTheDocument()
  })
})
