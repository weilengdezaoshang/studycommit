import { usePapersState } from './papers-store'
import { RecordsListPage } from './RecordsListPage'

export function ProblemsPage(): React.JSX.Element {
  const state = usePapersState()
  const papers = state.papers
    .filter((paper) => !paper.deletedAt && state.extras[paper.id]?.hasQuestion)
    .map((paper) => ({ ...paper, extra: state.extras[paper.id] }))
  return (
    <RecordsListPage
      mode="questions"
      title="还在思考的问题"
      papers={papers}
      topicNameOf={(paper) =>
        state.topics.find((topic) => topic.id === paper.topicId)?.name ?? '待整理'
      }
      emptyCopy="暂时没有记下的问题"
    />
  )
}
