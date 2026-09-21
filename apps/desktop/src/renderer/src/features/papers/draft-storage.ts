import { richTextDocumentSchema } from '@studycommit/rpc-contracts/rich-text'
import type { PaperDraft, PaperDraftStorage } from '@studycommit/common/paper-react'

export const PAPER_DRAFT_STORAGE_KEY = 'studycommit.paper-draft.v1'

type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function createDesktopDraftStorage(
  storage: LocalStorageLike = window.localStorage,
): PaperDraftStorage {
  return {
    async load(): Promise<PaperDraft | null> {
      const raw = storage.getItem(PAPER_DRAFT_STORAGE_KEY)
      if (!raw) {
        return null
      }
      try {
        const parsed = JSON.parse(raw) as Partial<PaperDraft> | null
        if (
          !parsed ||
          typeof parsed.paperId !== 'string' ||
          typeof parsed.content !== 'string' ||
          !Array.isArray(parsed.assetUploadIds)
        ) {
          throw new Error('本地草稿格式无效')
        }
        return {
          paperId: parsed.paperId,
          content: parsed.content,
          contentDocument: richTextDocumentSchema.safeParse(parsed.contentDocument).data,
          hasQuestion: Boolean(parsed.hasQuestion),
          questionText: typeof parsed.questionText === 'string' ? parsed.questionText : undefined,
          assetUploadIds: parsed.assetUploadIds.filter(
            (id): id is string => typeof id === 'string',
          ),
          localPhotoUri: typeof parsed.localPhotoUri === 'string' ? parsed.localPhotoUri : null,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
          attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
        }
      } catch {
        throw new Error('未能读取上次草稿')
      }
    },
    async save(draft: PaperDraft | null): Promise<void> {
      if (!draft) {
        storage.removeItem(PAPER_DRAFT_STORAGE_KEY)
        return
      }
      storage.setItem(PAPER_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    },
  }
}
