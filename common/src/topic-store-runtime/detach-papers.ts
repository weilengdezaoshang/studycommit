export interface StorePaper {
  topicId: string | null
  status: 'inbox' | 'organized'
  version: number
  updatedAt: string
  deletedAt: string | null
}

/**
 * 删除箱子时把箱内纸页移回待整理:解绑主题并递增版本,与服务端行为保持一致。
 */
export function detachTopicPapers<TPaper extends StorePaper>(
  papers: TPaper[],
  topicId: string,
  now: string,
): TPaper[] {
  return papers.map((paper) =>
    paper.topicId === topicId && !paper.deletedAt
      ? {
          ...paper,
          topicId: null,
          status: 'inbox' as const,
          version: paper.version + 1,
          updatedAt: now,
        }
      : paper,
  )
}
