import { usePapersState } from './papers-store'
import { RecordsListPage } from './RecordsListPage'

export function ProblemsPage(): React.JSX.Element {
  const state = usePapersState()
  const papers = state.papers
    // 问题回看页包含还在思考与已解决,页内筛选区分;旧演示数据缺状态时按侧车布尔兜底
    .filter(
      (paper) =>
        !paper.deletedAt &&
        (paper.questionStatus !== 'none' ||
          (paper.questionStatus === 'none' && state.extras[paper.id]?.hasQuestion)),
    )
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
