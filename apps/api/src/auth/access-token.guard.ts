import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { AUTH_ERROR } from './auth.constants'
import { AuthService } from './auth.service'

export type AuthedRequest = FastifyRequest & {
  userId: string
  sessionId: string
  accessToken: string
}

export function readBearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header
  return /^Bearer (.+)$/.exec(value ?? '')?.[1]
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    const token = readBearerToken(request.headers.authorization)
    if (!token) {
      throw new UnauthorizedException(AUTH_ERROR.unauthenticated)
    }
    const payload = await this.auth.requireAccess(token)
    request.userId = payload.userId
    request.sessionId = payload.sessionId
    request.accessToken = token
    return true
  }
}
