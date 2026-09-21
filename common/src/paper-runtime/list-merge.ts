import type { Paper } from '@studycommit/rpc-contracts/papers'

/** 列表/搜索省略 contentDocument；合并时保留同版本已拉取的详情文档。 */
export function mergeListedPaper(previous: Paper | undefined, incoming: Paper): Paper {
  if (incoming.contentDocument !== undefined || previous?.contentDocument === undefined) {
    return incoming
  }
  if (previous.version !== incoming.version) {
    return incoming
  }
  return { ...incoming, contentDocument: previous.contentDocument }
}
