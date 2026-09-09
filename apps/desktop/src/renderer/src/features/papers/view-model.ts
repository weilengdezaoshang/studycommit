import type { Paper } from '@studycommit/rpc-contracts/papers'
import type { PaperQuestionStatus } from '@studycommit/rpc-contracts/paper-question'
import type { PapersState } from './papers-store'

export type PaperWithExtra = Paper & {
  extra: {
    hasQuestion: boolean
    isQuestionResolved: boolean
    questionStatus: PaperQuestionStatus
    photoPath: string | null
  }
}

/** extras 尚未回填时的疑问缺省值。 */
export const EMPTY_PAPER_EXTRA: PaperWithExtra['extra'] = {
  hasQuestion: false,
  isQuestionResolved: false,
  questionStatus: 'none',
  photoPath: null,
}

/** 附加疑问信息并拷贝纸页:本地列表渲染的统一入口。 */
export function paperWithExtra(state: PapersState, paper: Paper): PaperWithExtra {
  return { ...paper, extra: state.extras[paper.id] ?? EMPTY_PAPER_EXTRA }
}

/** 疑问是否还在思考:优先取本地 questionStatus,缺省回退纸页字段。 */
export function isOpenQuestion(paper: PaperWithExtra): boolean {
  return paper.extra.questionStatus
    ? paper.extra.questionStatus === 'thinking'
    : paper.extra.hasQuestion && !paper.extra.isQuestionResolved
}
