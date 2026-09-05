import { oc } from '@orpc/contract'
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

export const deviceTypeSchema = z.enum(['desktop', 'mobile', 'miniprogram'])
export const phoneSchema = z.string().regex(/^1\d{10}$/)

export const sendPhoneCodeInputSchema = z.object({
  phone: phoneSchema,
})

export const sendPhoneCodeOutputSchema = z.object({
  expiresInSeconds: z.number().int().positive(),
})

export const verifyPhoneInputSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/),
  deviceType: deviceTypeSchema,
})

export const currentUserSchema = z.object({
  id: z.uuid(),
  nickname: z.string().min(1).max(50),
  avatarUrl: z.string().url().nullable(),
  status: z.enum(['active', 'disabled', 'merged']),
})

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.iso.datetime({ offset: true }),
})

export const verifyPhoneOutputSchema = z.object({
  user: currentUserSchema,
  tokens: authTokensSchema,
})

export const wechatMiniprogramLoginInputSchema = z.object({
  code: z.string().trim().min(1).max(128),
})

const accountCredentialSchema = z.object({
  account: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fff]+$/, '账号仅能包含字母、数字、下划线或汉字'),
  password: z.string().min(8).max(128),
})

export const accountRegisterInputSchema = accountCredentialSchema.extend({
  /** 可选昵称:缺省时服务端以账号派生 */
  nickname: z.string().trim().min(2).max(30).optional(),
})

export const accountRegisterOutputSchema = z.object({
  account: z.string().min(2).max(32),
})

export const accountLoginInputSchema = accountCredentialSchema.extend({
  deviceType: deviceTypeSchema,
})

export const authContract = {
  sendPhoneCode: oc
    .route({ method: 'POST', path: '/auth/phone/code', summary: '发送手机验证码' })
    .input(sendPhoneCodeInputSchema)
    .output(sendPhoneCodeOutputSchema),
  verifyPhone: oc
    .route({ method: 'POST', path: '/auth/phone/verify', summary: '手机验证码登录' })
    .input(verifyPhoneInputSchema)
    .output(verifyPhoneOutputSchema),
  registerAccount: oc
    .route({
      method: 'POST',
      path: '/auth/account/register',
      successStatus: 201,
      summary: '注册账号密码用户',
    })
    .input(accountRegisterInputSchema)
    .output(accountRegisterOutputSchema),
  loginAccount: oc
    .route({ method: 'POST', path: '/auth/account/login', summary: '账号密码登录' })
    .input(accountLoginInputSchema)
    .output(verifyPhoneOutputSchema),
  loginWechatMiniprogram: oc
    .route({ method: 'POST', path: '/auth/wechat/miniprogram', summary: '微信小程序登录' })
    .input(wechatMiniprogramLoginInputSchema)
    .output(verifyPhoneOutputSchema),
  refreshToken: oc
    .route({ method: 'POST', path: '/auth/token/refresh', summary: '刷新访问令牌' })
    .input(refreshInputSchema)
    .output(authTokensSchema),
  logout: oc.route({
    method: 'POST',
    path: '/auth/logout',
    successStatus: 204,
    summary: '退出登录并吊销会话',
  }),
  me: oc
    .route({ method: 'GET', path: '/me', summary: '查看当前登录用户' })
    .output(currentUserSchema),
}

export type AuthUser = z.infer<typeof authUserSchema>
export type TokenPair = z.infer<typeof tokenPairSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type DeviceType = z.infer<typeof deviceTypeSchema>
export type SendPhoneCodeInput = z.infer<typeof sendPhoneCodeInputSchema>
export type SendPhoneCodeOutput = z.infer<typeof sendPhoneCodeOutputSchema>
export type VerifyPhoneInput = z.infer<typeof verifyPhoneInputSchema>
export type CurrentUser = z.infer<typeof currentUserSchema>
export type AuthTokens = z.infer<typeof authTokensSchema>
export type VerifyPhoneOutput = z.infer<typeof verifyPhoneOutputSchema>
export type WechatMiniprogramLoginInput = z.infer<typeof wechatMiniprogramLoginInputSchema>
export type AccountLoginInput = z.infer<typeof accountLoginInputSchema>
export type AccountRegisterInput = z.infer<typeof accountRegisterInputSchema>
export type AccountRegisterOutput = z.infer<typeof accountRegisterOutputSchema>
