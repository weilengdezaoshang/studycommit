import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, NavLink } from 'react-router'
import { RecordsListPage } from './features/papers/RecordsListPage'
import { ProblemsPage } from './features/papers/ProblemsPage'
import { usePapersState } from './features/papers/papers-store'
import { applyTheme } from './theme/css-variables'
import { studyCommitColors } from '@studycommit/design-tokens'
import './styles.css'
applyTheme(document.documentElement.style, 'light')
document.body.style.background = studyCommitColors.canvas
function Preview({ inbox = false }: { inbox?: boolean }) {
  const state = usePapersState()
  return (
    <RecordsListPage
      key={String(inbox)}
      mode={inbox ? 'inbox' : 'box'}
      title={inbox ? '待整理的纸页' : '移动端设计'}
      emptyCopy="纸页都收好了"
      papers={[
        ...state.papers,
        ...(!inbox
          ? [
              {
                ...state.papers[0],
                id: 'preview-long-paper',
                topicId: 'topic-mobile',
                status: 'organized' as const,
                content:
                  '长文阅读示例（合成内容）\n\n' +
                  Array.from(
                    { length: 18 },
                    (_, index) =>
                      `第 ${index + 1} 段：安全区域不是固定的顶部留白。阅读一篇长笔记时，内容应该按照自然顺序展开，保留当时记录的段落与换行。列表只承担查找的任务，预览帮助确认内容；需要仔细阅读时，再进入完整的记录页面。`,
                  ).join('\n\n'),
              },
            ]
          : []),
      ]
        .filter((paper) => (inbox ? paper.status === 'inbox' : paper.topicId === 'topic-mobile'))
        .map((paper) => ({
          ...paper,
          extra: state.extras[paper.id] ?? {
            hasQuestion: false,
            isQuestionResolved: false,
            photoPath: null,
          },
        }))}
      topicNameOf={(paper) =>
        state.topics.find((topic) => topic.id === paper.topicId)?.name ?? '待整理'
      }
    />
  )
}
createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <nav
      className="collection-preview-nav"
      style={{
        display: 'flex',
        gap: 24,
        padding: '20px 40px',
        borderBottom: `1px solid ${studyCommitColors.line}`,
      }}
    >
      <NavLink to="/" end>
        箱子详情
      </NavLink>
      <NavLink to="/inbox">待整理</NavLink>
      <NavLink to="/problems">问题</NavLink>
    </nav>
    <Routes>
      <Route path="/" element={<Preview />} />
      <Route path="/timeline" element={<Preview />} />
      <Route path="/inbox" element={<Preview inbox />} />
      <Route path="/problems" element={<ProblemsPage />} />
    </Routes>
  </MemoryRouter>,
)
