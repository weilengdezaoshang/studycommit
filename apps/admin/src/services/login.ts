export const ACCOUNT_PATTERN = /^[a-zA-Z0-9_\u4e00-\u9fff]+$/

export interface LoginFormInput {
  account: string
  password: string
}

export interface LoginFieldErrors {
  account?: string
  password?: string
}

export function validateLoginForm(input: LoginFormInput): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  const account = input.account.trim()
  if (!account) {
    errors.account = '请输入账号'
  } else if (account.length < 2 || account.length > 32 || !ACCOUNT_PATTERN.test(account)) {
    errors.account = '账号需为 2–32 位字母、数字、下划线或汉字'
  }
  if (!input.password) {
    errors.password = '请输入密码'
  } else if (input.password.length < 8 || input.password.length > 128) {
    errors.password = '密码长度需为 8–128 位'
  }
  return errors
}

/** 登录请求体与契约 accountLoginInputSchema 对齐,使用 account 而非 email. */
export function buildAccountLoginBody(input: LoginFormInput): {
  account: string
  password: string
  deviceType: 'desktop'
} {
  return {
    account: input.account.trim(),
    password: input.password,
    deviceType: 'desktop',
  }
}
