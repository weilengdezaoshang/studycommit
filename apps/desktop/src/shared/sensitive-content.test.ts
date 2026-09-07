import { describe, expect, it } from 'vitest'
import { findSensitiveContent, SENSITIVE_NOTICE } from './sensitive-content'

describe('sensitive content heuristics', () => {
  it('命中手机号、身份证与银行卡', () => {
    const findings = findSensitiveContent(
      '联系我 13812345678，证件 11010119900307867X，卡号 6222020200112233445',
    )
    const kinds = findings.map((finding) => finding.kind)
    expect(kinds).toContain('phone')
    expect(kinds).toContain('id-card')
    expect(kinds).toContain('bank-card')
    // 身份证命中的数字串不再重复记为银行卡
    expect(findings.filter((finding) => finding.kind === 'bank-card')).toHaveLength(1)
  })

  it('命中密码字样且大小写不敏感', () => {
    const findings = findSensitiveContent('the password is hidden / 服务器口令')
    expect(findings.filter((finding) => finding.kind === 'password-word')).toHaveLength(2)
  })

  it('普通文本与短数字不误报', () => {
    expect(findSensitiveContent('调度器使用小顶堆管理任务,版本号 123456')).toEqual([])
    expect(findSensitiveContent('')).toEqual([])
  })

  it('提示文案可遮盖后重新截图或仅保存问题', () => {
    expect(SENSITIVE_NOTICE).toContain('可遮盖后重新截图')
    expect(SENSITIVE_NOTICE).toContain('仅保存问题')
  })
})
