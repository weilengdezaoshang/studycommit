import { useCallback } from 'react'
import { createIdempotencyKey } from '@studycommit/common/study-session-runtime'
import type { StudySessionController } from '@studycommit/common/study-session-react'
import { useDesktopServices } from './api/DesktopServicesProvider'

/**
 * 收尾回写(C04):按会话版本与幂等键提交 completePaper,
 * 理解回写当前纸页;下一个问题生成关联来源会话的新纸页。
 */
export function useCompletePaperHandler(study: StudySessionController) {
  const { studySessions } = useDesktopServices()
  return useCallback(
    async ({
      understandingText,
      nextQuestionText,
    }: {
      understandingText: string
      nextQuestionText?: string
    }) => {
      const session = study.session
      if (!session) {
        return
      }
      await studySessions.completePaper({
        sessionId: session.id,
        version: session.version,
        understandingText,
        ...(nextQuestionText ? { nextQuestionText, nextPaperId: crypto.randomUUID() } : {}),
        idempotencyKey: createIdempotencyKey(),
      })
      study.reload()
    },
    [study, studySessions],
  )
}
