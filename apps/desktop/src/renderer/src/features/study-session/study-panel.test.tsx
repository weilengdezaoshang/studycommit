import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  pausedStudySessionFixture,
  runningStudySessionFixture,
} from '@studycommit/common/contracts'
import { createStudySessionGateway, renderStudyApp } from './test/render-study'

describe('记录本学习入口', () => {
  it('学习中显示继续学习入口,点击打开学习面板', async () => {
    const user = userEvent.setup()
    renderStudyApp('/timeline', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: runningStudySessionFixture,
          serverNow: '2026-08-17T08:10:00.000Z',
          paper: null,
        }),
      }),
    })

    const entry = await screen.findByRole('button', { name: '学习中 · 继续学习' })
    await user.click(entry)

    expect(screen.getByRole('dialog', { name: '学习面板' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完成学习' })).toBeInTheDocument()
    // 面板内突出片段输入
    expect(screen.getByLabelText('记下一点')).toBeInTheDocument()
  })

  it('已暂停时入口显示已暂停,Esc 收起面板不结束学习', async () => {
    const user = userEvent.setup()
    renderStudyApp('/timeline', {
      studySessions: createStudySessionGateway({
        getActive: async () => ({
          session: pausedStudySessionFixture,
          serverNow: '2026-08-17T08:10:00.000Z',
          paper: null,
        }),
      }),
    })

    const entry = await screen.findByRole('button', { name: '已暂停 · 继续学习' })
    await user.click(entry)
    expect(screen.getByRole('dialog', { name: '学习面板' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '学习面板' })).not.toBeInTheDocument()
    // 会话未被结束:入口仍在,可再次打开
    expect(screen.getByRole('button', { name: '已暂停 · 继续学习' })).toBeInTheDocument()
  })

  it('没有活动学习时不显示学习入口', async () => {
    renderStudyApp('/timeline')
    expect(await screen.findByText(/全部记录 · \d+ 条记录/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /继续学习/ })).not.toBeInTheDocument()
  })
})
