import { describe, expect, it, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { BadRequestException } from '@nestjs/common'
import { IDEMPOTENCY_ERROR, IDEMPOTENCY_RECORDS_PKEY } from '../common/idempotency'
import { PAPER_CREATE_KIND } from './papers.constants'
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
  it('creates a paper and derives inbox status', async () => {
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

  it('returns not found for another user or deleted paper', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(null) }
    await expect(
      new PapersService(repository as never).get(userId, paperId),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('passes list filters through and maps the page', async () => {
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

  it('rejects reusing an idempotency key with different content', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ kind: PAPER_CREATE_KIND.idempotencyConflict }),
    }
    await expect(
      new PapersService(repository as never).create(userId, { content: 'other' }, 'key'),
    ).rejects.toMatchObject({ response: { code: IDEMPOTENCY_ERROR.keyReused.code } })
  })

  it('retries after an idempotency unique conflict', async () => {
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

  it('maps an invalid cursor to a bad request', async () => {
    const repository = { list: vi.fn().mockRejectedValue(new Error('INVALID_CURSOR')) }
    await expect(
      new PapersService(repository as never).list(userId, { limit: 20 }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
