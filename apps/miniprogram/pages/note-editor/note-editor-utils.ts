export type NoteDraft = {
  content: string
  isQuestionActive: boolean
  photoPath: string
}

export function parseNoteDraft(value: unknown): NoteDraft {
  if (typeof value === 'string') {
    return { content: value, isQuestionActive: false, photoPath: '' }
  }
  if (!value || typeof value !== 'object') {
    return { content: '', isQuestionActive: false, photoPath: '' }
  }
  const draft = value as Partial<NoteDraft>
  return {
    content: typeof draft.content === 'string' ? draft.content : '',
    isQuestionActive: draft.isQuestionActive === true,
    photoPath: typeof draft.photoPath === 'string' ? draft.photoPath : '',
  }
}

export function formatEditorDate(date: Date): { dateLabel: string; signatureLabel: string } {
  const month = date.getMonth() + 1
  const day = date.getDate()
  return {
    dateLabel: `${month}月${day}日`,
    signatureLabel: `${date.getFullYear()} · STUDYCOMMIT`,
  }
}
