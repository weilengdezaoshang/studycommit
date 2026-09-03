import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RecordsListPage } from './RecordsListPage'
import { ProblemsPage } from './ProblemsPage'
import { usePapersState } from './papers-store'

function Inbox() {
  const state = usePapersState()
  return (
    <RecordsListPage
      mode="inbox"
      title="待整理的纸页"
      emptyCopy="纸页都收好了"
      topicNameOf={() => '待整理'}
      papers={state.papers
        .filter((paper) => paper.status === 'inbox')
        .map((paper) => ({
          ...paper,
          extra: state.extras[paper.id] ?? {
            hasQuestion: false,
            isQuestionResolved: false,
            photoPath: null,
          },
        }))}
    />
  )
}

describe('纸页收纳与问题回看', () => {
  it('归入箱子后从待整理列表移除并显示归档反馈', () => {
    render(
      <MemoryRouter>
        <Inbox />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByLabelText('给这张纸页找个归属'), { target: { value: 'topic-js' } })
    fireEvent.click(screen.getByRole('button', { name: '归入箱子' }))
    expect(screen.getByText('纸页都收好了')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('纸页已归入「JavaScript」')
  })
  it('标记弄懂后仍能在已经弄懂筛选中阅读原记录', () => {
    render(
      <MemoryRouter>
        <ProblemsPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: '我已经弄懂了' }))
    fireEvent.click(screen.getByRole('button', { name: '已经弄懂' }))
    expect(screen.getByText('这个问题，已经弄懂了')).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveTextContent('为什么 React 的状态更新不是立即生效')
  })

  it('改回还在思考后问题重新出现在还在思考筛选中', () => {
    render(
      <MemoryRouter>
        <ProblemsPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: '我已经弄懂了' }))
    fireEvent.click(screen.getByRole('button', { name: '已经弄懂' }))
    fireEvent.click(screen.getByRole('button', { name: '改回还在思考' }))

    fireEvent.click(screen.getByRole('button', { name: '还在思考' }))
    expect(screen.getByRole('heading', { level: 1, name: '还在思考的问题' })).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveTextContent('为什么 React 的状态更新不是立即生效')
  })
})

describe('箱子管理', () => {
  function Box({ topicId }: { topicId: string }) {
    const state = usePapersState()
    const papers = state.papers
      .filter((paper) => !paper.deletedAt && paper.topicId === topicId)
      .map((paper) => ({
        ...paper,
        extra: state.extras[paper.id] ?? {
          hasQuestion: false,
          isQuestionResolved: false,
          photoPath: null,
        },
      }))
    return (
      <RecordsListPage
        mode="box"
        title={state.topics.find((topic) => topic.id === topicId)?.name ?? '箱子'}
        topicId={topicId}
        papers={papers}
        emptyCopy="这个箱子还没有纸页。"
        topicNameOf={() => 'JavaScript'}
      />
    )
  }

  it('重命名箱子后标题和抽屉同步更新', () => {
    render(
      <MemoryRouter>
        <Box topicId="topic-js" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('管理这个箱子'))
    fireEvent.click(screen.getByRole('button', { name: '重命名' }))
    fireEvent.change(screen.getByLabelText('箱子名称'), { target: { value: '工程实践' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByRole('heading', { name: '工程实践' })).toBeInTheDocument()
  })

  it('删除箱子前需要确认，删除后箱内纸页回到待整理', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    function Probe() {
      const state = usePapersState()
      const p3 = state.papers.find((paper) => paper.id === 'p-3')
      return (
        <div data-testid="store-probe">
          {JSON.stringify({
            hasTopicJs: state.topics.some((topic) => topic.id === 'topic-js'),
            p3Status: p3?.status,
            p3TopicId: p3?.topicId,
          })}
        </div>
      )
    }
    render(
      <MemoryRouter>
        <Box topicId="topic-js" />
        <Probe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByText('管理这个箱子'))
    fireEvent.click(screen.getByRole('button', { name: '删除箱子' }))

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('store-probe')).toHaveTextContent(
      JSON.stringify({ hasTopicJs: false, p3Status: 'inbox', p3TopicId: null }),
    )
    confirm.mockRestore()
  })
})

describe('长文阅读', () => {
  it('打开全文后保留列表筛选和选中记录，返回时恢复列表滚动位置', () => {
    const longText = '这是一段需要完整阅读的长文。'.repeat(100) + '全文最后一段。'
    const paper = {
      id: 'long-paper',
      content: longText,
      status: 'organized' as const,
      topicId: 'topic-js',
      version: 1,
      createdAt: '2026-08-31T00:00:00Z',
      updatedAt: '2026-08-31T00:00:00Z',
      deletedAt: null,
      hasQuestion: false,
      isQuestionResolved: false,
      extra: { hasQuestion: false, isQuestionResolved: false, photoPath: null },
    }
    render(
      <MemoryRouter>
        <RecordsListPage
          title="长文箱子"
          papers={[paper]}
          emptyCopy="空"
          topicNameOf={() => 'JavaScript'}
        />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '长文' } })
    const list = screen.getByRole('navigation', { name: '纸页列表' })
    list.scrollTop = 80
    fireEvent.click(screen.getByRole('button', { name: '阅读全文' }))
    expect(screen.getByRole('region', { name: '记录详情' })).toHaveTextContent('全文最后一段。')
    expect(screen.queryByRole('navigation', { name: '纸页列表' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回长文箱子' }))
    expect(screen.getByRole('searchbox')).toHaveValue('长文')
    expect(screen.getByRole('navigation', { name: '纸页列表' })).toBe(list)
    expect(list.scrollTop).toBe(80)
    expect(screen.getByRole('button', { name: '阅读全文' })).toHaveFocus()
  })
})
