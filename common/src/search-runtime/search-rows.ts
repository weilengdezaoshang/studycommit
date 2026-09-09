/**
 * 统一搜索展示行(BE-310):桌面搜索页与移动搜索页共用的结果模型。
 * 箱子行保留名称与纸页数,由各端自行排版;纸页行标题为创建日期、摘录为正文。
 */

export interface SearchRowPaper {
  type: 'paper'
  id: string
  /** 纸页创建日期(YYYY-MM-DD) */
  title: string
  /** 正文摘录 */
  detail: string
}

export interface SearchRowTopic {
  type: 'topic'
  id: string
  name: string
  count: number
}

export type SearchRow = SearchRowPaper | SearchRowTopic

export interface SearchablePaper {
  id: string
  content: string
  createdAt: string
  topicId: string | null
  deletedAt: string | null
}

export interface SearchableTopic {
  id: string
  name: string
}

export interface LocalSearchSource {
  papers: ReadonlyArray<SearchablePaper>
  topics: ReadonlyArray<SearchableTopic>
}

/** 服务端查询结果的最小结构:桌面 IPC 网关与移动 oRPC 服务都满足。 */
export interface SearchQueryResult {
  papers: { items: ReadonlyArray<{ id: string; content: string; createdAt: string }> }
  topics: ReadonlyArray<{ id: string; name: string; paperCount: number }>
}

export const SEARCH_LOCAL_RESULT_LIMIT = 10
export const SEARCH_DEBOUNCE_MS = 300

export function searchRowKey(row: SearchRow): string {
  return `${row.type}-${row.id}`
}

/** 服务端命中映射为展示行:箱子在前、纸页在后,与本地过滤顺序一致。 */
export function toServerSearchRows(result: SearchQueryResult): SearchRow[] {
  return [
    ...result.topics.map((topic) => ({
      type: 'topic' as const,
      id: topic.id,
      name: topic.name,
      count: topic.paperCount,
    })),
    ...result.papers.items.map((paper) => ({
      type: 'paper' as const,
      id: paper.id,
      title: paper.createdAt.slice(0, 10),
      detail: paper.content,
    })),
  ]
}

/** 本地过滤:箱子名称与纸页正文包含匹配(忽略大小写),各取前 10 条,箱子在前。 */
export function filterLocalSearchRows(source: LocalSearchSource, keyword: string): SearchRow[] {
  const lower = keyword.toLowerCase()
  if (!lower) {
    return []
  }
  const topicRows = source.topics
    .filter((topic) => topic.name.toLowerCase().includes(lower))
    .slice(0, SEARCH_LOCAL_RESULT_LIMIT)
    .map((topic) => ({
      type: 'topic' as const,
      id: topic.id,
      name: topic.name,
      count: source.papers.filter((paper) => paper.topicId === topic.id && !paper.deletedAt).length,
    }))
  const paperRows = source.papers
    .filter((paper) => !paper.deletedAt && paper.content.toLowerCase().includes(lower))
    .slice(0, SEARCH_LOCAL_RESULT_LIMIT)
    .map((paper) => ({
      type: 'paper' as const,
      id: paper.id,
      title: paper.createdAt.slice(0, 10),
      detail: paper.content,
    }))
  return [...topicRows, ...paperRows]
}

/** 服务端结果优先,本地补充未命中的行(按 type-id 去重,同一条不重复出现)。 */
export function mergeSearchRows(serverRows: SearchRow[], localRows: SearchRow[]): SearchRow[] {
  const seen = new Set(serverRows.map(searchRowKey))
  return [...serverRows, ...localRows.filter((row) => !seen.has(searchRowKey(row)))]
}
