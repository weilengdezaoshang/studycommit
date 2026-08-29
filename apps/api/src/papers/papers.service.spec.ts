import { describe, expect, it, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { BadRequestException } from '@nestjs/common'
import { IDEMPOTENCY_ERROR, IDEMPOTENCY_RECORDS_PKEY } from '../common/idempotency'
import { TOPIC_ERROR } from '../topics/topic.constants'
import {
  PAPER_COMMAND_KIND,
  PAPER_CREATE_KIND,
  PAPER_ERROR,
  PAPER_ORGANIZE_KIND,
} from './papers.constants'
import { PapersService } from './papers.service'

const userId = crypto.randomUUID()
const paperId = crypto.randomUUID()
const row = {
  id: paperId,
  userId,
  content: '  记录一个想法  ',
  topicId: null,
  version: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
}

describe('PapersService', () => {
  it('创建记录并推导为待整理状态', async () => {
    const repository = {
      create: vi
        .fn()
        .mockResolvedValue({ kind: PAPER_CREATE_KIND.ok, paper: row, replayed: false }),
    }

    await expect(
      new PapersService(repository as never).create(userId, { content: row.content }, 'key'),
    ).resolves.toEqual({
      paper: {
        id: paperId,
        content: row.content,
        status: 'inbox',
        topicId: null,
        version: 1,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: null,
      },
      replayed: false,
    })
  })

  it('其他用户或已删除记录返回不存在', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(null) }
    await expect(
      new PapersService(repository as never).get(userId, paperId),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('透传列表筛选并映射分页结果', async () => {
    const repository = {
      list: vi
        .fn()
        .mockResolvedValue({ items: [row], pageInfo: { hasNextPage: false, nextCursor: null } }),
    }
    await expect(
      new PapersService(repository as never).list(userId, { limit: 20 }),
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: paperId, status: 'inbox' })],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    expect(repository.list).toHaveBeenCalledWith(userId, { limit: 20 })
  })

  it('相同幂等键用于不同内容时拒绝', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ kind: PAPER_CREATE_KIND.idempotencyConflict }),
    }
    await expect(
      new PapersService(repository as never).create(userId, { content: 'other' }, 'key'),
    ).rejects.toMatchObject({ response: { code: IDEMPOTENCY_ERROR.keyReused.code } })
  })

  it('幂等键唯一冲突后重试创建', async () => {
    const repository = {
      create: vi
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error('duplicate'), {
            cause: { constraint: IDEMPOTENCY_RECORDS_PKEY },
          }),
        )
        .mockResolvedValueOnce({ kind: PAPER_CREATE_KIND.ok, paper: row, replayed: true }),
    }
    await expect(
      new PapersService(repository as never).create(userId, { content: row.content }, 'key'),
    ).resolves.toEqual(expect.objectContaining({ replayed: true }))
    expect(repository.create).toHaveBeenCalledTimes(2)
  })

  it('无效分页游标映射为错误请求', async () => {
    const repository = { list: vi.fn().mockRejectedValue(new Error('INVALID_CURSOR')) }
    await expect(
      new PapersService(repository as never).list(userId, { limit: 20 }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('归入箱子后映射为已整理状态', async () => {
    const topicId = crypto.randomUUID()
    const repository = {
      organize: vi.fn().mockResolvedValue({
        kind: PAPER_ORGANIZE_KIND.ok,
        paper: { ...row, topicId, version: 2 },
      }),
    }
    await expect(
      new PapersService(repository as never).organize(userId, {
        id: paperId,
        topicId,
        version: 1,
      }),
    ).resolves.toMatchObject({ status: 'organized', topicId, version: 2 })
  })

  it('版本冲突时带上当前记录', async () => {
    const repository = {
      organize: vi.fn().mockResolvedValue({
        kind: PAPER_ORGANIZE_KIND.versionConflict,
        paper: { ...row, version: 2 },
      }),
    }
    await expect(
      new PapersService(repository as never).organize(userId, {
        id: paperId,
        topicId: crypto.randomUUID(),
        version: 1,
      }),
    ).rejects.toMatchObject({
      response: {
        code: PAPER_ERROR.versionConflict.code,
        details: { paper: expect.objectContaining({ version: 2 }) },
      },
    })
  })

  it('已归档主题不可归类', async () => {
    const repository = {
      organize: vi.fn().mockResolvedValue({ kind: PAPER_ORGANIZE_KIND.topicArchived }),
    }
    await expect(
      new PapersService(repository as never).organize(userId, {
        id: paperId,
        topicId: crypto.randomUUID(),
        version: 1,
      }),
    ).rejects.toMatchObject({ response: { code: TOPIC_ERROR.archived.code } })
  })

  it('修改正文后保持箱子并增加版本', async () => {
    const topicId = crypto.randomUUID()
    const repository = {
      update: vi.fn().mockResolvedValue({
        kind: PAPER_COMMAND_KIND.ok,
        paper: { ...row, content: '改后的内容', topicId, version: 2 },
      }),
    }
    await expect(
      new PapersService(repository as never).update(userId, {
        id: paperId,
        content: '改后的内容',
        version: 1,
      }),
    ).resolves.toMatchObject({
      content: '改后的内容',
      topicId,
      status: 'organized',
      version: 2,
    })
  })

  it('修改正文版本冲突时带上当前记录', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue({
        kind: PAPER_COMMAND_KIND.versionConflict,
        paper: { ...row, version: 2 },
      }),
    }
    await expect(
      new PapersService(repository as never).update(userId, {
        id: paperId,
        content: '另一段内容',
        version: 1,
      }),
    ).rejects.toMatchObject({
      response: {
        code: PAPER_ERROR.versionConflict.code,
        details: { paper: expect.objectContaining({ version: 2 }) },
      },
    })
  })

  it('移回待整理后映射为待整理状态', async () => {
    const repository = {
      moveToInbox: vi.fn().mockResolvedValue({
        kind: PAPER_COMMAND_KIND.ok,
        paper: { ...row, topicId: null, version: 3 },
      }),
    }
    await expect(
      new PapersService(repository as never).moveToInbox(userId, { id: paperId, version: 2 }),
    ).resolves.toMatchObject({ status: 'inbox', topicId: null, version: 3 })
  })

  it('移回待整理时记录不存在', async () => {
    const repository = {
      moveToInbox: vi.fn().mockResolvedValue({ kind: PAPER_COMMAND_KIND.notFound }),
    }
    await expect(
      new PapersService(repository as never).moveToInbox(userId, { id: paperId, version: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('删除成功后返回删除时间与新版本', async () => {
    const deletedAt = new Date('2026-01-01T01:00:00.000Z')
    const repository = {
      remove: vi.fn().mockResolvedValue({
        kind: PAPER_COMMAND_KIND.ok,
        paper: { ...row, version: 2, deletedAt },
      }),
    }
    await expect(
      new PapersService(repository as never).remove(userId, { id: paperId, version: 1 }),
    ).resolves.toEqual({
      id: paperId,
      version: 2,
      deletedAt: deletedAt.toISOString(),
    })
  })

  it('删除版本冲突时带上当前记录', async () => {
    const repository = {
      remove: vi.fn().mockResolvedValue({
        kind: PAPER_COMMAND_KIND.versionConflict,
        paper: { ...row, version: 2 },
      }),
    }
    await expect(
      new PapersService(repository as never).remove(userId, { id: paperId, version: 1 }),
    ).rejects.toMatchObject({
      response: {
        code: PAPER_ERROR.versionConflict.code,
        details: { paper: expect.objectContaining({ version: 2 }) },
      },
    })
  })
})
