export const COMPLETION_NOTE_FIELDS = [
  { key: 'gains', label: '学习收获', placeholder: '这次掌握了什么？', maxLength: 10_000 },
  { key: 'problems', label: '未解决问题', placeholder: '还有什么需要继续？', maxLength: 10_000 },
  { key: 'nextStep', label: '下一步', placeholder: '下一次准备做什么？', maxLength: 5_000 },
] as const

export type CompletionNoteKey = (typeof COMPLETION_NOTE_FIELDS)[number]['key']

export function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length === 0 ? null : trimmed
}
