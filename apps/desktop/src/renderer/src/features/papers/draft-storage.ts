import type { PaperDraftStorage } from '@studycommit/common/paper-react'
import type { PaperDraft } from '@studycommit/common/paper-runtime'

const DRAFT_STORAGE_KEY = 'studycommit.desktop.compose-draft.v1'

/**
 * 桌面写记录草稿的本地存储(C05/R68):渲染进程 localStorage,仅保存在本机。
 * 读写失败静默降级:草稿丢失不影响继续编辑,只是没有可恢复内容。
 */
export function createDesktopDraftStorage(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage,
): PaperDraftStorage {
  return {
    async load() {
      try {
        const raw = storage.getItem(DRAFT_STORAGE_KEY)
        return raw ? (JSON.parse(raw) as PaperDraft) : null
      } catch {
        return null
      }
    },
    async save(draft) {
      try {
        if (draft) {
          storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
        } else {
          storage.removeItem(DRAFT_STORAGE_KEY)
        }
      } catch {
        // 存储不可用(隐私模式/配额)时静默:不影响编辑
      }
    },
  }
}
