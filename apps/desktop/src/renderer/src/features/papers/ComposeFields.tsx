import {
  PAPER_CONTENT_MAX_LENGTH,
  PAPER_QUESTION_MAX_LENGTH,
} from '@studycommit/common/paper-runtime'
import type { PaperDraft, PaperDraftAction } from '@studycommit/common/paper-react'
import { LengthFeedback } from '../../components/notebook/Notebook'
import { RichTextEditor } from './RichTextEditor'

/** 纯编辑字段，不拥有存储、请求或路由。 */
export function ComposeFields({
  draft,
  disabled,
  dispatch,
  onValidityChange,
}: {
  draft: PaperDraft
  disabled: boolean
  dispatch: (action: PaperDraftAction) => void
  onValidityChange: (valid: boolean) => void
}) {
  return (
    <>
      <RichTextEditor
        initialText={draft.content}
        initialDocument={draft.contentDocument}
        disabled={disabled}
        onValidityChange={onValidityChange}
        onChange={(value) => dispatch({ type: 'setContent', ...value, now: Date.now() })}
      />
      <LengthFeedback label="正文" value={draft.content} limit={PAPER_CONTENT_MAX_LENGTH} />
      <details className="compose-question" open={Boolean(draft.questionText) || undefined}>
        <summary>留下一个疑问（选填）</summary>
        <textarea
          aria-label="这个问题"
          aria-describedby="compose-question-limit"
          aria-invalid={(draft.questionText?.trim().length ?? 0) > PAPER_QUESTION_MAX_LENGTH}
          placeholder="把还没弄懂的部分写成一个问题"
          value={draft.questionText ?? ''}
          disabled={disabled}
          onChange={(event) =>
            dispatch({
              type: 'setQuestion',
              hasQuestion: Boolean(event.target.value.trim()),
              questionText: event.target.value,
              now: Date.now(),
            })
          }
        />
        <LengthFeedback
          id="compose-question-limit"
          label="疑问"
          value={draft.questionText ?? ''}
          limit={PAPER_QUESTION_MAX_LENGTH}
        />
      </details>
    </>
  )
}
