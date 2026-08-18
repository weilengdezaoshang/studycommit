import { screen, userEvent } from '@testing-library/react-native'
import { activeTopicFixture, runningStudySessionFixture } from '@studycommit/common/contracts'
import { HttpError } from '@studycommit/common/http'
import { createStudySessionGateway, createTopicGateway, renderStudyApp } from '../test/render-study'

const secondTopic = {
  ...activeTopicFixture,
  id: '44444444-4444-4444-8444-444444444444',
  name: 'React Native',
}

describe('StartStudyPanel', () => {
  it('keeps the topic dropdown closed and blocks submit until topic and goal are filled', async () => {
    const user = userEvent.setup()
    await renderStudyApp({
      topics: createTopicGateway({
        listActive: async () => ({
          items: [activeTopicFixture, secondTopic],
          pageInfo: { hasNextPage: false, nextCursor: null },
        }),
      }),
    })
    await user.press(await screen.findByRole('button', { name: '开始学习' }))
    expect(await screen.findByLabelText('专题')).toBeOnTheScreen()
    expect(screen.getByText('请选择专题')).toBeOnTheScreen()
    expect(screen.queryByRole('menuitem', { name: activeTopicFixture.name })).not.toBeOnTheScreen()
    expect(screen.getByLabelText('学习目标')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '开始学习' })).toBeDisabled()
    expect(screen.getByText('请选择一个专题后再开始。')).toBeOnTheScreen()
    expect(screen.getByText('请填写学习目标后再开始。')).toBeOnTheScreen()

    await user.press(screen.getByLabelText('专题'))
    await user.press(screen.getByRole('menuitem', { name: activeTopicFixture.name }))
    expect(screen.getByRole('button', { name: '开始学习' })).toBeDisabled()
    await user.type(screen.getByLabelText('学习目标'), '理解 IPC')
    expect(screen.getByRole('button', { name: '开始学习' })).toBeEnabled()
  })

  it('shows a path to topics when none exist', async () => {
    const user = userEvent.setup()
    await renderStudyApp({
      topics: createTopicGateway({
        listActive: async () => ({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
      }),
    })
    await user.press(await screen.findByRole('button', { name: '开始学习' }))
    await user.press(await screen.findByRole('button', { name: '前往专题' }))
    expect(screen.getByText('整理你的知识专题')).toBeOnTheScreen()
  })

  it('creates a session once and stays on today with timer controls', async () => {
    const user = userEvent.setup()
    const create = jest.fn().mockResolvedValue(runningStudySessionFixture)
    await renderStudyApp({
      studySessions: createStudySessionGateway({ create }),
    })
    await user.press(await screen.findByRole('button', { name: '开始学习' }))
    await user.press(await screen.findByLabelText('专题'))
    await user.press(await screen.findByRole('menuitem', { name: activeTopicFixture.name }))
    await user.type(screen.getByLabelText('学习目标'), '理解 IPC')
    await user.press(screen.getByRole('button', { name: '开始学习' }))
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      topicId: activeTopicFixture.id,
      goal: '理解 IPC',
    })
    expect(await screen.findByRole('button', { name: '暂停' })).toBeOnTheScreen()
  })

  it('enters the existing session when create conflicts', async () => {
    const user = userEvent.setup()
    await renderStudyApp({
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
    await user.press(await screen.findByRole('button', { name: '开始学习' }))
    await user.press(await screen.findByLabelText('专题'))
    await user.press(await screen.findByRole('menuitem', { name: activeTopicFixture.name }))
    await user.type(screen.getByLabelText('学习目标'), '理解 IPC')
    await user.press(screen.getByRole('button', { name: '开始学习' }))
    expect(await screen.findByRole('button', { name: '暂停' })).toBeOnTheScreen()
  })
})
