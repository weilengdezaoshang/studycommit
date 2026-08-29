import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'
import { AUTH_ERROR } from './auth.constants'
import { AuthService } from './auth.service'
import { readBearerToken, type AuthedRequest } from './access-token.guard'

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
