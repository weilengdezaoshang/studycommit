/**
 * 纸页问题运行时:状态机本体在 @studycommit/rpc-contracts/paper-question(服务端与客户端共用的单一事实来源),
 * 这里再导出并补充客户端侧的派生与乐观更新纯函数。
 * 注意:类型不再在此处重复导出,避免与 contracts 桶导出冲突;需要类型时从
 * '@studycommit/rpc-contracts/paper-question' 或 '@studycommit/common/contracts' 引入。
 */
export {
  QUESTION_ERROR_MESSAGE,
  QUESTION_TEXT_MAX_LENGTH,
  planQuestionTransition,
  questionStatusOfBooleans,
} from '@studycommit/rpc-contracts/paper-question'
export {
  applyQuestionCommand,
  applyQuestionConfirmed,
  questionExtrasOf,
  questionFieldsForCreate,
} from './paper-question-apply'
export type { PaperQuestionExtras } from './paper-question-apply'
