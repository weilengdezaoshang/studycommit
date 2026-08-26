import { z } from 'zod'

export const authUserSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
})

export const tokenPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.iso.datetime({ offset: true }),
})

export const loginInputSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('password'),
    email: z.string().email(),
    password: z.string().min(1),
  }),
  z.object({ provider: z.literal('apple'), authorizationCode: z.string().min(1) }),
  z.object({ provider: z.literal('wechat'), code: z.string().min(1) }),
  z.object({ provider: z.literal('device'), deviceCode: z.string().min(1) }),
])

export const authSessionSchema = z.object({
  user: authUserSchema,
  tokens: tokenPairSchema,
})

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1),
})

export type AuthUser = z.infer<typeof authUserSchema>
export type TokenPair = z.infer<typeof tokenPairSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
