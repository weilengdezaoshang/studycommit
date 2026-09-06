import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SyncPill } from './SyncPill'
import { papersActions } from '../../features/papers/papers-store'
import type { StudyCommitApi } from '../../types/study-commit-api'

function stubStudyCommit(partial: Partial<StudyCommitApi>) {
  window.studyCommit = { ...window.studyCommit, ...partial }
}

const serverPaper = {
  id: '9a111111-1111-4111-8111-111111111111',
  content: '云端纸页内容',
  status: 'inbox' as const,
  topicId: null,
  version: 1,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  deletedAt: null,
}

function okList() {
  return vi.fn().mockResolvedValue({
    ok: true as const,
    data: { items: [serverPaper], pageInfo: { hasNextPage: false, nextCursor: null } },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SyncPill 同步状态胶囊', () => {
  it('未同步过云端时显示本地工作', () => {
    render(<SyncPill />)
    expect(screen.getByText('本地工作')).toBeInTheDocument()
  })

  it('同步进行中显示同步中提示', async () => {
    let resolveList: (value: unknown) => void = () => {}
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveList = resolve
          }),
        ),
      },
    })
    render(<SyncPill />)
    const pending = papersActions.loadRemote()

    expect(await screen.findByText('同步中…')).toBeInTheDocument()
    resolveList({
      ok: true,
      data: { items: [serverPaper], pageInfo: { hasNextPage: false, nextCursor: null } },
    })
    await pending
  })

  it('同步失败显示可点击重试的胶囊', async () => {
    const user = userEvent.setup()
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi.fn().mockResolvedValue({ ok: false as const, error: { message: '服务不可用' } }),
      },
    })
    await papersActions.loadRemote()
    render(<SyncPill />)

    const retry = screen.getByRole('button', { name: '同步失败 · 点击重试' })
    stubStudyCommit({ papers: { ...window.studyCommit.papers, list: okList() } })
    await user.click(retry)

    expect(await screen.findByText(/已同步 ·/)).toBeInTheDocument()
  })

  it('同步成功后显示已同步与相对时间', async () => {
    stubStudyCommit({
      papers: { ...window.studyCommit.papers, list: okList() },
    })
    await papersActions.loadRemote()
    render(<SyncPill />)

    expect(screen.getByText(/已同步 · 刚刚/)).toBeInTheDocument()
  })
})
