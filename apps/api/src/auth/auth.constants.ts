export const AUTH_PROVIDER = {
  phone: 'phone',
} as const

export const AUTH_CODE_TTL_SECONDS = 600
export const AUTH_CODE_COOLDOWN_SECONDS = 60
export const AUTH_OTP_MAX_FAILURES = 5
export const AUTH_IDENTITIES_PROVIDER_SUBJECT_UNIQUE = 'auth_identities_provider_subject_unique'
export const DEFAULT_NICKNAME = '学习者'

export const AUTH_ERROR = {
  codeInvalid: { code: 'AUTH_CODE_INVALID', message: '验证码不正确，请重新输入' },
  codeExpired: { code: 'AUTH_CODE_EXPIRED', message: '验证码已失效，请重新获取' },
  codeCooldown: { code: 'AUTH_CODE_COOLDOWN', message: '请稍后再获取验证码' },
  unauthenticated: { code: 'UNAUTHENTICATED', message: '缺少有效身份' },
  accountDisabled: { code: 'AUTH_ACCOUNT_DISABLED', message: '账户不可用' },
} as const
