/**
 * 账号密码登录/注册的共享校验与文案(R65)。
 * 规则镜像后端契约 accountCredentialSchema:账号 2–32 位字母/数字/下划线/汉字,
 * 密码 8–128 字符,注册时确认密码一致,昵称可选 2–30 字。
 * auth-form.test.ts 与 rpc-contracts 的 zod schema 做对齐校验,防止漂移。
 */

export type AuthMode = 'login' | 'register'

export const AUTH_ACCOUNT_MIN_LENGTH = 2
export const AUTH_ACCOUNT_MAX_LENGTH = 32
export const AUTH_PASSWORD_MIN_LENGTH = 8
export const AUTH_PASSWORD_MAX_LENGTH = 128
export const AUTH_NICKNAME_MIN_LENGTH = 2
export const AUTH_NICKNAME_MAX_LENGTH = 30

/** 与后端账号规则一致:仅字母、数字、下划线或汉字。 */
export const AUTH_ACCOUNT_PATTERN = /^[a-zA-Z0-9_\u4e00-\u9fff]+$/

export const AUTH_ERROR = {
  accountLength: `账号至少 ${AUTH_ACCOUNT_MIN_LENGTH} 个字符`,
  accountTooLong: `账号最多 ${AUTH_ACCOUNT_MAX_LENGTH} 个字符`,
  accountFormat: '账号仅能包含字母、数字、下划线或汉字',
  passwordLength: `密码至少 ${AUTH_PASSWORD_MIN_LENGTH} 位`,
  passwordMismatch: '两次输入的密码不一致',
  nicknameLength: '昵称需 2-30 个字符',
  agreementRequired: '请先勾选同意《用户协议》和《隐私政策》',
  registerFallback: '注册失败',
  loginFallback: '登录失败',
  registerSuccessNotice: '注册成功，请登录',
  loginResponseMalformed: '登录响应格式异常',
} as const

export interface AuthFormValues {
  account: string
  password: string
  /** 注册时的确认密码;登录时忽略 */
  confirmPassword?: string
  /** 注册的可选昵称;登录时忽略 */
  nickname?: string
  /**
   * 注册协议勾选;登录时忽略。
   * 仅在该字段显式为 false 时拦截:桌面注册无勾选框,不传即不校验。
   */
  agreed?: boolean
}

export function isAccountReady(account: string): boolean {
  return account.trim().length >= AUTH_ACCOUNT_MIN_LENGTH
}

export function isPasswordReady(password: string): boolean {
  return password.length >= AUTH_PASSWORD_MIN_LENGTH
}

/** 注册昵称:留空跳过,填写时 2-30 字(与后端可选契约一致)。 */
export function isNicknameValid(nickname: string): boolean {
  const trimmed = nickname.trim()
  return (
    trimmed.length === 0 ||
    (trimmed.length >= AUTH_NICKNAME_MIN_LENGTH && trimmed.length <= AUTH_NICKNAME_MAX_LENGTH)
  )
}

/**
 * 提交按钮可用性:只做长度、一致性与勾选检查;
 * 账号字符格式的明确报错放在提交时的 validateAuthSubmit,避免输入过程按钮抖动。
 */
export function authCanSubmit(
  mode: AuthMode,
  values: AuthFormValues,
  submitting: boolean,
): boolean {
  if (submitting) {
    return false
  }
  if (!isAccountReady(values.account) || !isPasswordReady(values.password)) {
    return false
  }
  if (mode === 'register') {
    if (values.password !== (values.confirmPassword ?? '')) {
      return false
    }
    if (!isNicknameValid(values.nickname ?? '')) {
      return false
    }
    if (values.agreed === false) {
      return false
    }
  }
  return true
}

/** 提交校验:返回首个错误的用户文案;通过时返回 null。 */
export function validateAuthSubmit(mode: AuthMode, values: AuthFormValues): string | null {
  const account = values.account.trim()
  if (account.length < AUTH_ACCOUNT_MIN_LENGTH) {
    return AUTH_ERROR.accountLength
  }
  if (account.length > AUTH_ACCOUNT_MAX_LENGTH) {
    return AUTH_ERROR.accountTooLong
  }
  if (!AUTH_ACCOUNT_PATTERN.test(account)) {
    return AUTH_ERROR.accountFormat
  }
  if (values.password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return AUTH_ERROR.passwordLength
  }
  if (mode === 'register') {
    if (values.password !== (values.confirmPassword ?? '')) {
      return AUTH_ERROR.passwordMismatch
    }
    if (!isNicknameValid(values.nickname ?? '')) {
      return AUTH_ERROR.nicknameLength
    }
    if (values.agreed === false) {
      return AUTH_ERROR.agreementRequired
    }
  }
  return null
}

export function authSubmitLabel(mode: AuthMode, submitting: boolean): string {
  if (submitting) {
    return mode === 'register' ? '注册中' : '登录中'
  }
  return mode === 'register' ? '注册' : '登录'
}

export function authSwitchPrompt(mode: AuthMode): string {
  return mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'
}

export function authAgreementFooter(mode: AuthMode): string {
  return `${mode === 'login' ? '登录' : '注册'}即代表你同意《用户协议》和《隐私政策》`
}

/**
 * 从认证请求异常中提取用户文案:兼容 `{ error: { message } }` 信封与 Error 实例,
 * 都取不到时使用调用方给定的兜底文案。
 */
export function extractAuthErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const payload = (error as { error?: { message?: string } }).error
    if (payload?.message) {
      return payload.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
