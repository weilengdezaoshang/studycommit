import { describe, expect, it } from 'vitest'
import {
  createPaperDraftReducer,
  paperCreateInputOf,
  paperDraftValidationError,
  PAPER_DRAFT_ERROR,
  type PaperDraft,
} from './draft'

const PAPER_ID = '8f2a6d3c-91b4-4e5a-b7c8-2d1e0f9a8b7c'

function draftWith(overrides: Partial<PaperDraft> = {}): PaperDraft {
  return {
    paperId: PAPER_ID,
    content: '今天理解了乐观锁的回写时机',
    hasQuestion: false,
    assetUploadIds: [],
    localPhotoUri: null,
    updatedAt: 1_000,
    attempts: 0,
    ...overrides,
  }
}

describe('createPaperDraftReducer', () => {
  it('空草稿上 start 以客户端 UUID 建立初始草稿', () => {
    const next = createPaperDraftReducer(null, { type: 'start', paperId: PAPER_ID, now: 1_000 })
    expect(next).toMatchObject({
      paperId: PAPER_ID,
      content: '',
      hasQuestion: false,
      assetUploadIds: [],
      attempts: 0,
      updatedAt: 1_000,
    })
  })

  it('已有草稿时 start 保持原状以免覆盖恢复内容', () => {
    const existing = draftWith()
    expect(
      createPaperDraftReducer(existing, { type: 'start', paperId: PAPER_ID, now: 2_000 }),
    ).toBe(existing)
  })

  it('restore 保留原 paperId 与失败次数,保证重试复用同一幂等键', () => {
    const stored = draftWith({ attempts: 2, updatedAt: 5_000 })
    const next = createPaperDraftReducer(null, { type: 'restore', draft: stored })
    expect(next).toBe(stored)
  })

  it('取消问题标记时同步清空问题文本', () => {
    const state = draftWith({ hasQuestion: true, questionText: '为什么回滚要用旧引用' })
    const next = createPaperDraftReducer(state, {
      type: 'setQuestion',
      hasQuestion: false,
      now: 2_000,
    })
    expect(next).toMatchObject({ hasQuestion: false, questionText: undefined })
  })

  it('重复附加与超出上限的资产被忽略', () => {
    const state = draftWith({ assetUploadIds: ['a'] })
    const deduped = createPaperDraftReducer(state, {
      type: 'attachAsset',
      uploadId: 'a',
      now: 2_000,
    })
    expect(deduped?.assetUploadIds).toEqual(['a'])
    let capped = deduped
    for (let index = 1; index < 9; index += 1) {
      capped = createPaperDraftReducer(capped, {
        type: 'attachAsset',
        uploadId: `asset-${index}`,
        now: 2_000,
      })
    }
    expect(capped?.assetUploadIds).toHaveLength(9)
    const rejected = createPaperDraftReducer(capped, {
      type: 'attachAsset',
      uploadId: 'asset-overflow',
      now: 2_000,
    })
    expect(rejected?.assetUploadIds).toHaveLength(9)
  })

  it('保存失败保留正文并累计次数供重试提示', () => {
    let state: PaperDraft | null = draftWith()
    state = createPaperDraftReducer(state, { type: 'saveFailed', now: 2_000 })
    state = createPaperDraftReducer(state, { type: 'saveFailed', now: 3_000 })
    expect(state).toMatchObject({
      attempts: 2,
      content: '今天理解了乐观锁的回写时机',
      updatedAt: 3_000,
    })
  })

  it('保存成功后清空草稿', () => {
    expect(createPaperDraftReducer(draftWith(), { type: 'saveSucceeded' })).toBeNull()
  })

  it('丢弃草稿返回空', () => {
    expect(createPaperDraftReducer(draftWith(), { type: 'discard' })).toBeNull()
  })
})

describe('paperDraftValidationError', () => {
  it('正文为空白时给出先写点什么的提示', () => {
    expect(paperDraftValidationError(draftWith({ content: '   ' }))).toBe(
      PAPER_DRAFT_ERROR.contentRequired,
    )
  })

  it('正文超出上限时给出超长提示', () => {
    expect(paperDraftValidationError(draftWith({ content: '字'.repeat(20_001) }))).toBe(
      PAPER_DRAFT_ERROR.contentTooLong,
    )
  })

  it('问题文本超出上限时给出超长提示', () => {
    expect(
      paperDraftValidationError(draftWith({ hasQuestion: true, questionText: '问'.repeat(2_001) })),
    ).toBe(PAPER_DRAFT_ERROR.questionTooLong)
  })

  it('正常草稿校验通过', () => {
    expect(paperDraftValidationError(draftWith())).toBeNull()
  })
})

describe('paperCreateInputOf', () => {
  it('归一化正文并剔除首尾空白', () => {
    expect(paperCreateInputOf(draftWith({ content: '  前后有空格的正文  ' }))).toMatchObject({
      content: '前后有空格的正文',
      hasQuestion: false,
    })
  })

  it('标记问题且有问题文本时携带归一化的问题文本', () => {
    expect(
      paperCreateInputOf(draftWith({ hasQuestion: true, questionText: ' 乐观锁什么时候生效  ' })),
    ).toMatchObject({ hasQuestion: true, questionText: '乐观锁什么时候生效' })
  })

  it('未附加资产时不携带资产字段', () => {
    expect(paperCreateInputOf(draftWith()).assetUploadIds).toBeUndefined()
  })

  it('已附加资产时携带上传会话 ID', () => {
    expect(paperCreateInputOf(draftWith({ assetUploadIds: ['upload-1'] }))).toMatchObject({
      assetUploadIds: ['upload-1'],
    })
  })
})
