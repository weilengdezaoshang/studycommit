export const PAPER_KNOWLEDGE_COPY = {
  heading: '后来我想到',
  empty: '还没有补充理解',
  understand: '补充理解',
  apply: '记录应用',
  link: '关联记录',
  save: '保存补充',
  saving: '保存中…',
  placeholder: '保留原文，在这里补上新的想法',
} as const

export function knowledgeHistoryLabel(count: number, hasMore = false): string {
  return hasMore ? `变化历史 · ${count}+ 条` : `变化历史 · ${count} 条`
}

export function knowledgeRelationLabel(count: number, hasMore = false): string {
  return hasMore ? `相关记录 · ${count}+ 条` : `相关记录 · ${count} 条`
}
