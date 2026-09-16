import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import type { AppEnv } from '../config/env'

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

/**
 * 内部接口 HMAC 守卫：
 * - 仅当配置了 INTERNAL_API_SIGNING_SECRET 时开放内部接口；
 * - 签名 = HMAC-SHA256(secret, `{timestamp}\n{sha256(bodyJson)}`)，
 *   时间戳 ±5 分钟内有效，防重放；
 * - 密钥与签名任何一项缺失即拒绝。
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppEnv>) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('INTERNAL_API_SIGNING_SECRET')
    if (!secret) {
      throw new ForbiddenException({ code: 'INTERNAL_DISABLED', message: '内部接口未启用' })
    }
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const timestamp = readHeader(request, 'x-internal-timestamp')
    const signature = readHeader(request, 'x-internal-signature')
    if (!timestamp || !signature) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '缺少内部签名' })
    }
    const timestampMs = Number.parseInt(timestamp, 10)
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > TIMESTAMP_TOLERANCE_MS
    ) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '内部签名已过期' })
    }
    const bodyDigest = createHash('sha256')
      .update(JSON.stringify(request.body ?? {}))
      .digest('hex')
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}\n${bodyDigest}`)
      .digest('hex')
    if (!safeEqual(expected, signature)) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '内部签名不匹配' })
    }
    return true
  }
}

function readHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function safeEqual(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected, 'utf8')
  const receivedBytes = Buffer.from(received, 'utf8')
  if (expectedBytes.length !== receivedBytes.length) {
    return false
  }
  return timingSafeEqual(expectedBytes, receivedBytes)
}
