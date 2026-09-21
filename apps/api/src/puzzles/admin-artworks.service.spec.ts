import { describe, expect, it, vi } from 'vitest'
import { AdminArtworksService } from './admin-artworks.service'
import type { DatabaseService } from '../database/database.service'
import { adminAuditLogs, puzzleArtworkAssets } from '../database/schema'

const draft = {
  title: '春日来信',
  description: '一封来自春天的信。',
  assetKey: 'spring-rabbit',
  style: '水彩',
  sortOrder: 1,
}
function setup(status = 'draft', rewarded = false, assetExists = true) {
  const before = {
    ...draft,
    id: 'a',
    slug: 'spring-rabbit',
    status,
    version: 2,
    pieceCount: 12,
    updatedAt: new Date(),
    createdAt: new Date(),
    storageKey: 'puzzle-artworks/spring-rabbit/original.png',
    width: 1200,
    height: 900,
  }
  let updated = before
  const audit = vi.fn()
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          for: async () => [before],
          limit: async () =>
            table === puzzleArtworkAssets ? [before] : rewarded ? [{ id: 'reward' }] : [],
        }),
      }),
    }),
    update: vi.fn(() => ({
      set: (values: Partial<typeof before>) => {
        updated = { ...before, ...values }
        return { where: () => ({ returning: async () => [updated] }) }
      },
    })),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        if (table === adminAuditLogs) {
          audit(values)
          return Promise.resolve()
        }
        return { returning: async () => [{ ...before, status: 'draft', version: 1 }] }
      },
    }),
  }
  const service = new AdminArtworksService({
    db: {
      transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
      query: {
        puzzleArtworkAssets: {
          findFirst: () => (assetExists ? { key: draft.assetKey } : undefined),
        },
      },
    },
  } as unknown as DatabaseService)
  return { service, tx, audit }
}
describe('AdminArtworksService', () => {
  it('版本冲突时拒绝覆盖且不写审计', async () => {
    const { service, tx, audit } = setup()
    await expect(
      service.write('actor', { id: 'a', expectedVersion: 1, draft, reason: '编辑' }),
    ).rejects.toThrow('已被其他人更新')
    expect(tx.update).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })
  it('已发布画作必须先下架才能编辑', async () => {
    const { service } = setup('published')
    await expect(
      service.write('actor', { id: 'a', expectedVersion: 2, draft, reason: '编辑' }),
    ).rejects.toThrow('先下架')
  })
  it('已经发放碎片的画作拒绝替换原图', async () => {
    const { service } = setup('retired', true)
    await expect(
      service.write('actor', {
        id: 'a',
        expectedVersion: 2,
        draft: { ...draft, assetKey: 'seaside-cat' },
        reason: '换图',
      }),
    ).rejects.toThrow('不能替换原图')
  })
  it('发布草稿会增加版本并写入同一事务的审计记录', async () => {
    const { service, audit } = setup()
    const result = await service.write('actor', {
      id: 'a',
      expectedVersion: 2,
      status: 'published',
      reason: '检查完成',
    })
    expect(result.status).toBe('published')
    expect(result.version).toBe(3)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'actor',
        action: 'artwork.published',
        reason: '检查完成',
      }),
    )
  })
  it('拒绝素材库以外的路径', async () => {
    const { service } = setup('draft', false, false)
    await expect(
      service.write('actor', { draft: { ...draft, assetKey: 'unknown-image' }, reason: '新增' }),
    ).rejects.toThrow('素材库')
  })
  it('草稿不能直接下架', async () => {
    const { service } = setup()
    await expect(
      service.write('actor', { id: 'a', expectedVersion: 2, status: 'retired', reason: '下架' }),
    ).rejects.toThrow('只有已发布')
  })
})
