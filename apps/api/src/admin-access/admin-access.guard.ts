import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { readBearerToken, type AuthedRequest } from '../auth/identity.guard'
import { AuthService } from '../auth/auth.service'
import { AdminAccessRepository } from './admin-access.repository'
import { ADMIN_ERROR, type AdminRole } from './admin-access.constants'
import type { AdminIdentity } from './admin-access.service'

export type AdminRequest = AuthedRequest & { adminIdentity: AdminIdentity }

/**
 * 管理接口守卫:只接受真实 Bearer 会话。
 * 开发 x-user-id 回退在此被显式拒绝——它不是管理员凭证(方案 §2/§11)。
 * 守卫只判定"是管理员",具体操作的角色要求由 controller 调 AdminAccessService.requireRole。
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AdminAccessRepository) private readonly accessRepository: AdminAccessRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const token = readBearerToken(request.headers.authorization)
    if (!token) {
      throw new UnauthorizedException(ADMIN_ERROR.unauthenticated)
    }
    const payload = await this.auth.requireAccess(token)
    const role = await this.accessRepository.findRoleByUserId(payload.userId)
    if (!role) {
      throw new ForbiddenException(ADMIN_ERROR.forbidden)
    }
    const identity: AdminIdentity = { userId: payload.userId, role: role as AdminRole }
    ;(request as AdminRequest).adminIdentity = identity
    return true
  }
}

export type { AdminRole }
