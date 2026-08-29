import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import type {
  CurrentUser,
  DeviceType,
  SendPhoneCodeOutput,
  VerifyPhoneOutput,
} from '@studycommit/rpc-contracts/auth'
import { RedisService } from '../infrastructure/redis.service'
import {
  AUTH_CODE_COOLDOWN_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  AUTH_ERROR,
  AUTH_OTP_MAX_FAILURES,
  DEFAULT_NICKNAME,
} from './auth.constants'
import { AuthRepository, type User } from './auth.repository'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const phoneSubject = (phone: string) => sha256(`phone:${phone}`)
const otpKey = (phone: string) => `auth:otp:${phoneSubject(phone)}`
const otpCooldownKey = (phone: string) => `auth:otp-cd:${phoneSubject(phone)}`
const otpFailKey = (phone: string) => `auth:otp-fail:${phoneSubject(phone)}`
const accessKey = (token: string) => `auth:access:${sha256(token)}`
const sessionAccessKey = (sessionId: string) => `auth:session:${sessionId}`

const CONSUME_OTP_SCRIPT = `
local stored = redis.call('GET', KEYS[1])
if stored == false then
  return 0
end
if stored ~= ARGV[1] then
  local fails = redis.call('INCR', KEYS[2])
  redis.call('EXPIRE', KEYS[2], ARGV[2])
  if tonumber(fails) >= tonumber(ARGV[3]) then
    redis.call('DEL', KEYS[1])
    redis.call('DEL', KEYS[2])
    return 3
  end
  return 1
end
redis.call('DEL', KEYS[1])
redis.call('DEL', KEYS[2])
return 2
`

type AccessPayload = { userId: string; sessionId: string }

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async sendPhoneCode(phone: string): Promise<SendPhoneCodeOutput> {
    const cooled = await this.redis.setNxEx(otpCooldownKey(phone), AUTH_CODE_COOLDOWN_SECONDS, '1')
    if (!cooled) {
      throw new HttpException(AUTH_ERROR.codeCooldown, HttpStatus.TOO_MANY_REQUESTS)
    }
    const code = this.createOtp()
    await this.redis.setex(otpKey(phone), AUTH_CODE_TTL_SECONDS, sha256(code))
    return { expiresInSeconds: AUTH_CODE_TTL_SECONDS }
  }

  async verifyPhone(input: {
    phone: string
    code: string
    deviceType: DeviceType
  }): Promise<VerifyPhoneOutput> {
    await this.consumeOtp(input.phone, input.code)
    const subject = phoneSubject(input.phone)
    const identity = await this.repository.findPhoneIdentity(subject)
    const user = identity
      ? await this.requireActiveUser(identity.userId)
      : await this.repository.createPhoneUser(subject)
    const tokens = await this.issueTokens(user.id, input.deviceType)
    return { user: this.toCurrentUser(user), tokens }
  }

  async refresh(refreshToken: string) {
    const previousHash = sha256(refreshToken)
    const session = await this.repository.findActiveSessionByRefreshHash(previousHash)
    if (!session) {
      throw new UnauthorizedException(AUTH_ERROR.unauthenticated)
    }
    await this.requireActiveUser(session.userId)
    const next = this.createTokenPair()
    const rotated = await this.repository.rotateSession(
      session.id,
      previousHash,
      sha256(next.refreshToken),
      this.refreshExpiresAt(),
    )
    if (!rotated) {
      throw new UnauthorizedException(AUTH_ERROR.unauthenticated)
    }
    await this.storeAccess(next.accessToken, { userId: session.userId, sessionId: session.id })
    return next
  }

  async logout(accessToken: string) {
    const payload = await this.readAccess(accessToken)
    if (!payload) {
      throw new UnauthorizedException(AUTH_ERROR.unauthenticated)
    }
    await this.repository.revokeSession(payload.sessionId)
    await this.clearSessionAccess(payload.sessionId, accessToken)
  }

  async me(accessToken: string): Promise<CurrentUser> {
    const payload = await this.requireAccess(accessToken)
    return this.toCurrentUser(await this.requireActiveUser(payload.userId))
  }

  async requireAccess(accessToken: string | undefined): Promise<AccessPayload> {
    const payload = await this.readAccess(accessToken)
    if (!payload) {
      throw new UnauthorizedException(AUTH_ERROR.unauthenticated)
    }
    return payload
  }

  private async consumeOtp(phone: string, code: string) {
    const result = await this.redis.evalNumber(
      CONSUME_OTP_SCRIPT,
      [otpKey(phone), otpFailKey(phone)],
      [sha256(code), String(AUTH_CODE_TTL_SECONDS), String(AUTH_OTP_MAX_FAILURES)],
    )
    if (result === 2) {
      return
    }
    if (result === 1) {
      throw new BadRequestException(AUTH_ERROR.codeInvalid)
    }
    throw new BadRequestException(AUTH_ERROR.codeExpired)
  }

  private async requireActiveUser(userId: string) {
    const user = await this.repository.findUserById(userId)
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException(AUTH_ERROR.accountDisabled)
    }
    return user
  }

  private async issueTokens(userId: string, deviceType: DeviceType) {
    const tokens = this.createTokenPair()
    const session = await this.repository.createSession({
      userId,
      refreshTokenHash: sha256(tokens.refreshToken),
      deviceType,
      expiresAt: this.refreshExpiresAt(),
    })
    await this.storeAccess(tokens.accessToken, { userId, sessionId: session.id })
    return tokens
  }

  private createTokenPair() {
    return {
      accessToken: randomBytes(32).toString('base64url'),
      refreshToken: randomBytes(32).toString('base64url'),
      expiresAt: new Date(Date.now() + this.accessTtl() * 1000).toISOString(),
    }
  }

  private refreshExpiresAt() {
    return new Date(Date.now() + this.refreshTtl() * 1000)
  }

  private async storeAccess(token: string, payload: AccessPayload) {
    const ttl = this.accessTtl()
    const hash = sha256(token)
    const previous = await this.redis.get(sessionAccessKey(payload.sessionId))
    if (previous && previous !== hash) {
      await this.redis.del(`auth:access:${previous}`)
    }
    await this.redis.setex(accessKey(token), ttl, JSON.stringify(payload))
    await this.redis.setex(sessionAccessKey(payload.sessionId), ttl, hash)
  }

  private async clearSessionAccess(sessionId: string, accessToken: string) {
    const currentHash = await this.redis.get(sessionAccessKey(sessionId))
    if (currentHash) {
      await this.redis.del(`auth:access:${currentHash}`)
    }
    await this.redis.del(accessKey(accessToken))
    await this.redis.del(sessionAccessKey(sessionId))
  }

  private async readAccess(token: string | undefined) {
    if (!token) {
      return null
    }
    const raw = await this.redis.get(accessKey(token))
    if (!raw) {
      return null
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AccessPayload>
      if (typeof parsed.userId === 'string' && typeof parsed.sessionId === 'string') {
        return { userId: parsed.userId, sessionId: parsed.sessionId }
      }
    } catch {
      return null
    }
    return null
  }

  private createOtp() {
    return (
      this.config.get<string>('AUTH_OTP_STUB') ??
      randomInt(0, 1_000_000).toString().padStart(6, '0')
    )
  }

  private accessTtl() {
    return this.config.get<number>('AUTH_ACCESS_TTL_SECONDS') ?? 900
  }

  private refreshTtl() {
    return this.config.get<number>('AUTH_REFRESH_TTL_SECONDS') ?? 2_592_000
  }

  private toCurrentUser(user: User): CurrentUser {
    return {
      id: user.id,
      nickname: user.nickname || DEFAULT_NICKNAME,
      avatarUrl: user.avatarUrl ?? null,
      status: user.status,
    }
  }
}
