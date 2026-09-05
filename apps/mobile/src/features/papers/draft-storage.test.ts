import AsyncStorage from '@react-native-async-storage/async-storage'
import { createMobileDraftStorage, PAPER_DRAFT_STORAGE_KEY } from './draft-storage'
import type { PaperDraft } from '@studycommit/common/paper-react'

const storedDraft: PaperDraft = {
  paperId: '9a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d',
  content: '上次没保存的正文',
  hasQuestion: true,
  questionText: '为什么会被丢掉',
  assetUploadIds: [],
  localPhotoUri: null,
  updatedAt: 1_720_000_000_000,
  attempts: 1,
}

describe('mobile draft storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('保存后加载返回同一份草稿内容', async () => {
    const storage = createMobileDraftStorage()
    await storage.save(storedDraft)
    await expect(storage.load()).resolves.toEqual(storedDraft)
  })

  it('清除草稿后加载返回空', async () => {
    const storage = createMobileDraftStorage()
    await storage.save(storedDraft)
    await storage.save(null)
    await expect(storage.load()).resolves.toBeNull()
  })

  it('本地数据损坏时按无草稿处理而不是抛错', async () => {
    await AsyncStorage.setItem(PAPER_DRAFT_STORAGE_KEY, '{broken json')
    const storage = createMobileDraftStorage()
    await expect(storage.load()).resolves.toBeNull()
  })

  it('缺少草稿锚点的旧数据视为无效草稿', async () => {
    await AsyncStorage.setItem(PAPER_DRAFT_STORAGE_KEY, JSON.stringify({ content: '没有锚点' }))
    const storage = createMobileDraftStorage()
    await expect(storage.load()).resolves.toBeNull()
  })
})
