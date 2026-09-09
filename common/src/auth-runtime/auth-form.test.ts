import { describe, expect, it } from 'vitest'
import { accountRegisterInputSchema } from '@studycommit/rpc-contracts/auth'
import {
  AUTH_ACCOUNT_MAX_LENGTH,
  AUTH_ACCOUNT_MIN_LENGTH,
  AUTH_ERROR,
  authAgreementFooter,
  authCanSubmit,
  authSubmitLabel,
  authSwitchPrompt,
  extractAuthErrorMessage,
  isNicknameValid,
  validateAuthSubmit,
} from './index'

describe('auth form rules', () => {
  it('提交校验依次返回账号长度、格式与密码长度错误', () => {
    expect(validateAuthSubmit('login', { account: '  ', password: '12345678' })).toBe(
      AUTH_ERROR.accountLength,
    )
    expect(
      validateAuthSubmit('login', {
        account: 'a'.repeat(AUTH_ACCOUNT_MIN_LENGTH - 1),
        password: '12345678',
      }),
    ).toBe(AUTH_ERROR.accountLength)
    expect(validateAuthSubmit('login', { account: '含 空格', password: '12345678' })).toBe(
      AUTH_ERROR.accountFormat,
    )
    expect(validateAuthSubmit('login', { account: 'demo', password: '1234567' })).toBe(
      AUTH_ERROR.passwordLength,
    )
  })

  it('注册校验确认密码、昵称与协议勾选', () => {
    const base = { account: 'demo', password: '12345678' }
    expect(validateAuthSubmit('register', { ...base, confirmPassword: '12345678' })).toBeNull()
    expect(validateAuthSubmit('register', { ...base, confirmPassword: '87654321' })).toBe(
      AUTH_ERROR.passwordMismatch,
    )
    expect(
      validateAuthSubmit('register', { ...base, confirmPassword: '12345678', nickname: '短' }),
    ).toBe(AUTH_ERROR.nicknameLength)
    expect(
      validateAuthSubmit('register', { ...base, confirmPassword: '12345678', agreed: false }),
    ).toBe(AUTH_ERROR.agreementRequired)
    // 桌面端无协议勾选框:不传 agreed 不拦截
    expect(
      validateAuthSubmit('register', {
        account: 'demo',
        password: '12345678',
        confirmPassword: '12345678',
      }),
    ).toBeNull()
  })

  it('提交按钮可用性与双端现有规则一致', () => {
    const ready = { account: 'demo', password: '12345678', confirmPassword: '12345678' }
    expect(authCanSubmit('login', ready, false)).toBe(true)
    expect(authCanSubmit('login', ready, true)).toBe(false)
    expect(authCanSubmit('login', { account: 'd', password: '12345678' }, false)).toBe(false)
    expect(authCanSubmit('register', { ...ready, agreed: false }, false)).toBe(false)
    expect(authCanSubmit('register', { ...ready, agreed: true }, false)).toBe(true)
    // 桌面注册不传昵称与协议时与原有规则一致
    expect(
      authCanSubmit(
        'register',
        { account: 'demo', password: '12345678', confirmPassword: '12345678' },
        false,
      ),
    ).toBe(true)
    expect(
      authCanSubmit(
        'register',
        { account: 'demo', password: '12345678', confirmPassword: '不一致' },
        false,
      ),
    ).toBe(false)
  })

  it('昵称留空跳过校验,填写时要求 2-30 字', () => {
    expect(isNicknameValid('')).toBe(true)
    expect(isNicknameValid('  ')).toBe(true)
    expect(isNicknameValid('小')).toBe(false)
    expect(isNicknameValid('学习者')).toBe(true)
    expect(isNicknameValid('长'.repeat(31))).toBe(false)
    expect(isNicknameValid('长'.repeat(30))).toBe(true)
  })

  it('账号校验组合规则与后端注册契约对齐', () => {
    const samples = [
      'demo',
      'demo_user',
      '学习笔记01',
      'a'.repeat(AUTH_ACCOUNT_MAX_LENGTH),
      'a'.repeat(AUTH_ACCOUNT_MAX_LENGTH + 1),
      'has space',
      'bad!char',
      'a',
    ]
    for (const account of samples) {
      const validatorPasses =
        validateAuthSubmit('login', { account, password: '12345678' }) === null
      const schemaPasses = accountRegisterInputSchema.safeParse({
        account,
        password: '12345678',
      }).success
      expect({ account, validatorPasses, schemaPasses }).toEqual({
        account,
        validatorPasses: schemaPasses,
        schemaPasses,
      })
    }
  })

  it('按钮与切换文案随模式变化', () => {
    expect(authSubmitLabel('login', false)).toBe('登录')
    expect(authSubmitLabel('register', true)).toBe('注册中')
    expect(authSwitchPrompt('login')).toBe('没有账号？去注册')
    expect(authSwitchPrompt('register')).toBe('已有账号？去登录')
    expect(authAgreementFooter('login')).toContain('登录')
    expect(authAgreementFooter('register')).toContain('注册')
  })

  it('异常文案提取兼容信封、Error 与兜底', () => {
    expect(
      extractAuthErrorMessage({ error: { message: '账号或密码不正确' } }, AUTH_ERROR.loginFallback),
    ).toBe('账号或密码不正确')
    expect(extractAuthErrorMessage(new Error('网络超时'), AUTH_ERROR.loginFallback)).toBe(
      '网络超时',
    )
    expect(extractAuthErrorMessage(undefined, AUTH_ERROR.loginFallback)).toBe(
      AUTH_ERROR.loginFallback,
    )
  })
})
