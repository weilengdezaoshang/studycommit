import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_ERROR, type AdminRole } from './admin-access.constants'
import { AdminAccessService } from './admin-access.service'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ACTOR = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('AdminAccessService', () => {
  const repository = {
    findUserById: vi.fn(),
    findRoleByUserId: vi.fn(),
    transaction: vi.fn(),
    lockRoleGrantsInTx: vi.fn(),
    lockSuperAdminRolesInTx: vi.fn(),
    lockRoleByUserIdInTx: vi.fn(),
    upsertRoleInTx: vi.fn(),
    insertAuditLogInTx: vi.fn(),
    listRoles: vi.fn(),
  }
  let service: AdminAccessService

  beforeEach(() => {
    vi.clearAllMocks()
    repository.transaction.mockImplementation(async (work: (tx: unknown) => unknown) => work({}))
    repository.findUserById.mockImplementation(async (id: string) => ({ id }))
    service = new AdminAccessService(repository as never)
  })

  it('拒绝把最后一名超级管理员降级为其他角色,并在同一事务中加锁后校验', async () => {
    const order: string[] = []
    repository.lockRoleGrantsInTx.mockImplementation(async () => {
      order.push('advisory')
    })
    repository.lockSuperAdminRolesInTx.mockImplementation(async () => {
      order.push('lock-super')
      return [{ userId: USER_A, role: 'super_admin' }]
    })
    repository.lockRoleByUserIdInTx.mockImplementation(async () => {
      order.push('lock-target')
      return 'super_admin'
    })
    await expect(
      service.grantRole({
        actorUserId: ACTOR,
        targetUserId: USER_A,
        role: 'viewer',
        reason: '降级最后一名超管',
      }),
    ).rejects.toMatchObject({
      response: ADMIN_ERROR.lastSuperAdmin,
    })
    expect(order).toEqual(['advisory', 'lock-super', 'lock-target'])
    expect(repository.upsertRoleInTx).not.toHaveBeenCalled()
    expect(repository.insertAuditLogInTx).not.toHaveBeenCalled()
  })

  it('审计快照取自事务内锁定的角色,而不是事务外的过期读取', async () => {
    repository.lockSuperAdminRolesInTx.mockResolvedValue([
      { userId: USER_A, role: 'super_admin' },
      { userId: USER_B, role: 'super_admin' },
    ])
    repository.lockRoleByUserIdInTx.mockResolvedValue('super_admin')
    repository.findRoleByUserId.mockResolvedValue('viewer')
    await service.grantRole({
      actorUserId: ACTOR,
      targetUserId: USER_A,
      role: 'publisher',
      reason: '多名超管时允许降级',
    })
    expect(repository.insertAuditLogInTx.mock.calls[0][1].beforeSnapshot).toEqual({
      role: 'super_admin',
    })
    expect(repository.insertAuditLogInTx.mock.calls[0][1].afterSnapshot).toEqual({
      role: 'publisher',
    })
  })

  it('两名超管并发降级时仍保留至少一名', async () => {
    const roles = new Map<string, AdminRole>([
      [USER_A, 'super_admin'],
      [USER_B, 'super_admin'],
    ])
    let mutex = Promise.resolve()
    repository.transaction.mockImplementation(async (work: (tx: unknown) => unknown) => {
      const previous = mutex
      let release!: () => void
      mutex = new Promise<void>((resolve) => {
        release = resolve
      })
      await previous
      try {
        return await work({})
      } finally {
        release()
      }
    })
    repository.lockSuperAdminRolesInTx.mockImplementation(async () =>
      [...roles.entries()]
        .filter(([, role]) => role === 'super_admin')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([userId, role]) => ({ userId, role })),
    )
    repository.lockRoleByUserIdInTx.mockImplementation(
      async (_tx, userId: string) => roles.get(userId) ?? null,
    )
    repository.upsertRoleInTx.mockImplementation(
      async (_tx, input: { userId: string; role: AdminRole }) => {
        roles.set(input.userId, input.role)
      },
    )

    const demote = (targetUserId: string) =>
      service.grantRole({
        actorUserId: ACTOR,
        targetUserId,
        role: 'viewer',
        reason: '并发降级测试',
      })

    const results = await Promise.allSettled([demote(USER_A), demote(USER_B)])
    const remaining = [...roles.values()].filter((role) => role === 'super_admin').length
    expect(remaining).toBe(1)
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1)
    const rejected = results.find((item) => item.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toBeInstanceOf(BadRequestException)
    expect((rejected.reason as BadRequestException).getResponse()).toMatchObject(
      ADMIN_ERROR.lastSuperAdmin,
    )
  })
})
