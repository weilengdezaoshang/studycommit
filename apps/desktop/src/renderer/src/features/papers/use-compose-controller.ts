import { useMemo, useRef, useState } from 'react'
import { useRecoverableDraft } from '@studycommit/common/paper-react'
import { paperDraftValidationError } from '@studycommit/common/paper-runtime'
import { createDesktopDraftStorage } from './draft-storage'
import { papersActions } from './papers-store'

function subscribeAppState(listener: (state: 'active' | 'background') => void) {
  const handle = () => listener(document.hidden ? 'background' : 'active')
  document.addEventListener('visibilitychange', handle)
  return () => document.removeEventListener('visibilitychange', handle)
}

/** 仅做桌面服务适配与弹窗退出协调；持久化、恢复、幂等由公共Hook负责。 */
export function useComposeController(onClose: () => void, onSaved: (id: string) => void) {
  const lastId = useRef('')
  const storage = useMemo(() => createDesktopDraftStorage(), [])
  const controller = useRecoverableDraft({
    draftStorage: storage,
    papers: {
      create: async (input, options) => {
        const saved = await papersActions.createPaper({
          ...input,
          idempotencyKey: options?.idempotencyKey,
        })
        lastId.current = saved.id
        return saved
      },
    },
    createDraftId: () => crypto.randomUUID(),
    subscribeAppState,
  })
  const [closing, setClosing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [notice, setNotice] = useState('')
  const [documentValid, setDocumentValid] = useState(true)
  const draft = controller.draft
  const busy = controller.loading || controller.saving || closing
  const dirty = Boolean(
    draft && (draft.content.trim() || draft.questionText?.trim() || draft.assetUploadIds.length),
  )
  const canSave = Boolean(
    draft?.content.trim() && !paperDraftValidationError(draft) && documentValid && !busy,
  )
  const persist = async () => {
    if (!draft) {
      return
    }
    await controller.persist({ content: draft.content, contentDocument: draft.contentDocument })
  }
  const close = async (discard = false) => {
    if (busy) {
      return
    }
    setClosing(true)
    try {
      if (discard) {
        await controller.discard()
      } else {
        await persist()
      }
      onClose()
    } catch {
      setNotice('草稿未能保存到本机，请保持窗口打开，先复制内容备份。')
    } finally {
      setClosing(false)
    }
  }
  const requestClose = () => {
    if (busy) {
      return
    }
    if (!dirty || controller.savedAt) {
      void close()
    } else {
      setConfirmClose(true)
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        [draft?.content, draft?.questionText].filter(Boolean).join('\n\n'),
      )
      setNotice('内容已复制')
    } catch {
      setNotice('复制失败，请选中正文后手动复制。')
    }
  }
  return {
    ...controller,
    busy,
    canSave,
    confirmClose,
    setConfirmClose,
    notice,
    setDocumentValid,
    requestClose,
    close,
    copy,
    retryPersist: () => persist().catch(() => undefined),
    saveRecord: async () => {
      if (canSave && (await controller.save())) {
        onSaved(lastId.current)
      }
    },
  }
}
