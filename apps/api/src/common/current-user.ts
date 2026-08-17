import {
  createParamDecorator,
  ExecutionContext,
  Injectable,
  CanActivate,
  UnauthorizedException,
} from '@nestjs/common'
import { z } from 'zod'
import type { FastifyRequest } from 'fastify'
export type AuthRequest = FastifyRequest & { userId: string }
@Injectable()
export class TestIdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>()
    const result = z.uuid().safeParse(request.headers['x-user-id'])
    if (!result.success) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: '缺少有效身份',
        details: null,
      })
    }
    request.userId = result.data
    return true
  }
}
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().userId,
)
