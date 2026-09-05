import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
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
export class IdentityGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    const token = readBearerToken(request.headers.authorization)
    if (token) {
      const payload = await this.auth.requireAccess(token)
      request.userId = payload.userId
      request.sessionId = payload.sessionId
      request.accessToken = token
      return true
    }
    if (this.config.get('NODE_ENV') !== 'production') {
      const result = z.uuid().safeParse(request.headers['x-user-id'])
      if (result.success) {
        request.userId = result.data
        return true
      }
    }
    throw new UnauthorizedException(AUTH_ERROR.unauthenticated)
  }
}
