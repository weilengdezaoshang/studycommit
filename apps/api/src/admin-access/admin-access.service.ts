import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { ADMIN_ERROR, ADMIN_ROLE, ADMIN_ROLE_LEVEL, type AdminRole } from './admin-access.constants'
import { AdminAccessRepository } from './admin-access.repository'

/** 请求上已由 AdminGuard 注入的管理身份。 */
export interface AdminIdentity {
  userId: string
  role: AdminRole
}

/**
 * 管理权限校验:后端逐操作强制;前端权限显示只是体验。
 * 开发 x-user-id 身份在 AdminGuard 中被显式拒绝,不能充当管理员凭证。
 */
@Injectable()
export class AdminAccessService {
  constructor(@Inject(AdminAccessRepository) private readonly repository: AdminAccessRepository) {}

  /** 校验最低角色;不满足抛 403。 */
  requireRole(identity: AdminIdentity | null, minRole: AdminRole): AdminIdentity {
    if (!identity) {
      throw new ForbiddenException(ADMIN_ERROR.forbidden)
    }
    if (ADMIN_ROLE_LEVEL[identity.role] < ADMIN_ROLE_LEVEL[minRole]) {
      throw new ForbiddenException(ADMIN_ERROR.forbidden)
    }
    return identity
  }

  assertValidReason(reason: string | undefined) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException({
        code: 'ADMIN_REASON_REQUIRED',
        message: '危险操作必须提供操作理由',
      })
    }
    return reason.trim()
  }

  async grantRole(input: {
    actorUserId: string
    targetUserId: string
    role: AdminRole
    reason: string
    requestId?: string | null
  }) {
    const target = await this.repository.findUserById(input.targetUserId)
    if (!target) {
      throw new BadRequestException(ADMIN_ERROR.userNotFound)
    }
    return this.repository.transaction(async (tx) => {
      await this.repository.lockRoleGrantsInTx(tx)
      const superAdmins = await this.repository.lockSuperAdminRolesInTx(tx)
      const before = await this.repository.lockRoleByUserIdInTx(tx, input.targetUserId)
      if (
        before === ADMIN_ROLE.superAdmin &&
        input.role !== ADMIN_ROLE.superAdmin &&
        superAdmins.length <= 1
      ) {
        throw new BadRequestException(ADMIN_ERROR.lastSuperAdmin)
      }
      await this.repository.upsertRoleInTx(tx, {
        userId: input.targetUserId,
        role: input.role,
        grantedBy: input.actorUserId,
        reason: input.reason,
      })
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actorUserId,
        action: 'admin.grant_role',
        targetType: 'user',
        targetId: input.targetUserId,
        beforeSnapshot: before ? { role: before } : null,
        afterSnapshot: { role: input.role },
        reason: input.reason,
        requestId: input.requestId ?? null,
      })
      return { userId: input.targetUserId, role: input.role }
    })
  }

  async listRoles() {
    return this.repository.listRoles()
  }
}
