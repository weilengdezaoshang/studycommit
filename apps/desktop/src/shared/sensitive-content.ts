/**
 * 敏感内容本地启发式(DE-311 / PRD §5.4):
 * 只提示、不自动删除或修改内容,检测在本地完成、不上传。
 * 规则刻意保守(宁缺勿滥),命中的是"疑似"而非判定。
 */

export type SensitiveKind = 'phone' | 'id-card' | 'bank-card' | 'password-word'

export interface SensitiveFinding {
  kind: SensitiveKind
  /** 命中片段(用于展示,不额外脱敏——内容本就在本地) */
  sample: string
}

export const SENSITIVE_NOTICE = '检测到疑似敏感信息：可遮盖后重新截图，或仅保存问题'

const PATTERNS: { kind: SensitiveKind; pattern: RegExp }[] = [
  // 手机号:1 开头 11 位,前后不能是数字(避免切中更长号码)
  { kind: 'phone', pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g },
  // 身份证:18 位(末位可为 X),前后不能是数字
  { kind: 'id-card', pattern: /(?<!\d)\d{17}[\dXx](?!\d)/g },
  // 银行卡:13-19 位连续数字,前后不能是数字或 X(避免与身份证重叠)
  { kind: 'bank-card', pattern: /(?<!\d)\d{13,19}(?![\dXx])/g },
  // 密码字样:中文"密码"或常见英文口令词(行内出现即提示)
  { kind: 'password-word', pattern: /(密码|口令|password|passcode|passwd)/gi },
]

export function findSensitiveContent(text: string): SensitiveFinding[] {
  if (!text.trim()) {
    return []
  }
  const findings: SensitiveFinding[] = []
  const seen = new Set<string>()
  for (const { kind, pattern } of PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        break
      }
      const key = `${kind}:${match[0]}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      findings.push({ kind, sample: match[0] })
    }
  }
  // 同一长数字串可能同时命中身份证与银行卡:保留更具体的身份证命中
  const idSamples = new Set(
    findings.filter((finding) => finding.kind === 'id-card').map((finding) => finding.sample),
  )
  return findings.filter(
    (finding) => finding.kind !== 'bank-card' || !idSamples.has(finding.sample),
  )
}
