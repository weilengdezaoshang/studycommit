import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { activeTopicFixture, runningStudySessionFixture } from '@studycommit/common/contracts'
import { HttpError } from '@studycommit/common/http'
import { createStudySessionGateway, createTopicGateway, renderStudyApp } from '../test/render-study'

const secondTopic = {
  ...activeTopicFixture,
  id: '44444444-4444-4444-8444-444444444444',
  name: 'React Native',
}

describe('StartStudyPanel', () => {
  it('未选择专题或填写目标时禁止开始学习', async () => {
    renderStudyApp('/today', {
      topics: createTopicGateway({
        listActive: async () => ({
          items: [activeTopicFixture, secondTopic],
          pageInfo: { hasNextPage: false, nextCursor: null },
        }),
      }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '开始学习' }))
    expect(await screen.findByLabelText('专题')).toHaveTextContent('请选择专题')
    expect(screen.getByLabelText('学习目标')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始学习' })).toBeDisabled()
    expect(screen.getByText('请选择一个专题后再开始。')).toBeInTheDocument()
    expect(screen.getByText('请填写学习目标后再开始。')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('专题'))
    await userEvent.click(screen.getByRole('option', { name: activeTopicFixture.name }))
    expect(screen.getByRole('button', { name: '开始学习' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('学习目标'), '理解 IPC')
    expect(screen.getByRole('button', { name: '开始学习' })).toBeEnabled()
  })

  it('创建一次会话后显示计时控制', async () => {
    const create = vi.fn().mockResolvedValue(runningStudySessionFixture)
    renderStudyApp('/today', {
      studySessions: createStudySessionGateway({ create }),
    })
    await userEvent.click(await screen.findByRole('button', { name: '开始学习' }))
    await userEvent.click(await screen.findByLabelText('专题'))
    await userEvent.click(screen.getByRole('option', { name: activeTopicFixture.name }))
    await userEvent.type(screen.getByLabelText('学习目标'), '理解 IPC')
    await userEvent.click(screen.getByRole('button', { name: '开始学习' }))
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      topicId: activeTopicFixture.id,
      goal: '理解 IPC',
    })
    expect(await screen.findByRole('button', { name: '暂停' })).toBeInTheDocument()
  })

  it('创建冲突时进入已有学习会话', async () => {
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
    await userEvent.click(await screen.findByLabelText('专题'))
    await userEvent.click(screen.getByRole('option', { name: activeTopicFixture.name }))
    await userEvent.type(screen.getByLabelText('学习目标'), '理解 IPC')
    await userEvent.click(screen.getByRole('button', { name: '开始学习' }))
    expect(await screen.findByRole('button', { name: '暂停' })).toBeInTheDocument()
  })
})
