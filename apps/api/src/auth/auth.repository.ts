import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { isConstraint } from '../common/idempotency'
import { DatabaseService } from '../database/database.service'
import { authIdentities, authSessions, users } from '../database/schema'
import { AUTH_IDENTITIES_PROVIDER_SUBJECT_UNIQUE, AUTH_PROVIDER } from './auth.constants'
import type { DeviceType } from '@studycommit/rpc-contracts/auth'

export type User = typeof users.$inferSelect
export type AuthSession = typeof authSessions.$inferSelect

@Injectable()
export class AuthRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findUserById(id: string) {
    const [user] = await this.database.db.select().from(users).where(eq(users.id, id)).limit(1)
    return user ?? null
  }

  async findPhoneIdentity(subject: string) {
    return this.findIdentity(AUTH_PROVIDER.phone, subject)
  }

  async findIdentity(
    provider: (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER],
    subject: string,
  ) {
    const [identity] = await this.database.db
      .select()
      .from(authIdentities)
      .where(
        and(eq(authIdentities.provider, provider), eq(authIdentities.providerSubject, subject)),
      )
      .limit(1)
    return identity ?? null
  }

  async createAccountUser(subject: string, passwordHash: string, nickname: string) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({ nickname }).returning()
        await tx.insert(authIdentities).values({
          userId: user.id,
          provider: AUTH_PROVIDER.account,
          providerSubject: subject,
          passwordHash,
          verifiedAt: new Date(),
        })
        return user
      })
    } catch (error) {
      if (!isConstraint(error, AUTH_IDENTITIES_PROVIDER_SUBJECT_UNIQUE)) {
        throw error
      }
      return null
    }
  }

  async createPhoneUser(subject: string) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({}).returning()
        await tx.insert(authIdentities).values({
          userId: user.id,
          provider: AUTH_PROVIDER.phone,
          providerSubject: subject,
          verifiedAt: new Date(),
        })
        return user
      })
    } catch (error) {
      if (!isConstraint(error, AUTH_IDENTITIES_PROVIDER_SUBJECT_UNIQUE)) {
        throw error
      }
      const identity = await this.findPhoneIdentity(subject)
      const user = identity ? await this.findUserById(identity.userId) : null
      if (!user) {
        throw error
      }
      return user
    }
  }

  async createWechatUser(openid: string, unionid: string | null) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({}).returning()
        await tx.insert(authIdentities).values({
          userId: user.id,
          provider: AUTH_PROVIDER.wechatMini,
          providerSubject: openid,
          verifiedAt: new Date(),
        })
        if (unionid) {
          await tx.insert(authIdentities).values({
            userId: user.id,
            provider: AUTH_PROVIDER.wechatUnionid,
            providerSubject: unionid,
            verifiedAt: new Date(),
          })
        }
        return user
      })
    } catch (error) {
      if (!isConstraint(error, AUTH_IDENTITIES_PROVIDER_SUBJECT_UNIQUE)) {
        throw error
      }
      const mini = await this.findIdentity(AUTH_PROVIDER.wechatMini, openid)
      const union = unionid ? await this.findIdentity(AUTH_PROVIDER.wechatUnionid, unionid) : null
      const user = mini
        ? await this.findUserById(mini.userId)
        : union
          ? await this.findUserById(union.userId)
          : null
      if (!user) {
        throw error
      }
      return user
    }
  }

  async attachIdentity(
    userId: string,
    provider: (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER],
    subject: string,
  ) {
    try {
      await this.database.db.insert(authIdentities).values({
        userId,
        provider,
        providerSubject: subject,
        verifiedAt: new Date(),
      })
    } catch (error) {
      if (!isConstraint(error, AUTH_IDENTITIES_PROVIDER_SUBJECT_UNIQUE)) {
        throw error
      }
    }
  }

  async createSession(input: {
    userId: string
    refreshTokenHash: string
    deviceType: DeviceType
    expiresAt: Date
  }) {
    const [session] = await this.database.db.insert(authSessions).values(input).returning()
    return session
  }

  async findActiveSessionByRefreshHash(refreshTokenHash: string) {
    const [session] = await this.database.db
      .select()
      .from(authSessions)
      .where(
        and(eq(authSessions.refreshTokenHash, refreshTokenHash), isNull(authSessions.revokedAt)),
      )
      .limit(1)
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null
    }
    return session
  }

  async rotateSession(
    id: string,
    previousRefreshTokenHash: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ) {
    const [session] = await this.database.db
      .update(authSessions)
      .set({ refreshTokenHash, expiresAt })
      .where(
        and(
          eq(authSessions.id, id),
          eq(authSessions.refreshTokenHash, previousRefreshTokenHash),
          isNull(authSessions.revokedAt),
        ),
      )
      .returning()
    return session ?? null
  }

  async revokeSession(id: string) {
    await this.database.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authSessions.id, id))
  }
}
