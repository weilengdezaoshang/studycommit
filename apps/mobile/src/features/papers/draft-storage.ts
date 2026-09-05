import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PaperDraft, PaperDraftStorage } from '@studycommit/common/paper-react'

/** 移动端草稿本地存储:单键 JSON;损坏或缺失时按无草稿处理,不阻塞记录。 */
export const PAPER_DRAFT_STORAGE_KEY = 'studycommit.paper-draft.v1'

type AsyncStorageLike = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>

export function createMobileDraftStorage(
  storage: AsyncStorageLike = AsyncStorage,
): PaperDraftStorage {
  return {
    async load(): Promise<PaperDraft | null> {
      const raw = await storage.getItem(PAPER_DRAFT_STORAGE_KEY)
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
          return null
        }
        return {
          paperId: parsed.paperId,
          content: parsed.content,
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
        return null
      }
    },
    async save(draft: PaperDraft | null): Promise<void> {
      if (!draft) {
        await storage.removeItem(PAPER_DRAFT_STORAGE_KEY)
        return
      }
      await storage.setItem(PAPER_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    },
  }
}
