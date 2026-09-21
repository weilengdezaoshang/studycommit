import { describe, expect, it } from 'vitest'
import { explanationPreview } from './explanation-preview'

describe('explanationPreview', () => {
  it('字符串尚未闭合时逐步展示中文正文而不展示结构键', () => {
    expect(
      explanationPreview('{"view":{"type":"definition_counterexample","definition":"队列先'),
    ).toBe('队列先')
    expect(
      explanationPreview('{"view":{"type":"definition_counterexample","definition":"队列先进先出'),
    ).toBe('队列先进先出')
  })
  it('未收到正文或格式损坏时不泄露原始 JSON', () => {
    expect(explanationPreview('{"view":{"type":"causal_chain"')).toBe('')
    expect(explanationPreview('garbage')).toBe('')
  })
  it('保留多步内容和转义换行', () => {
    expect(
      explanationPreview(
        '{"view":{"steps":[{"title":"第一步","detail":"排队\\n等待"},{"title":"第二步","detail":"轮到',
      ),
    ).toBe('第一步：排队\n等待\n\n第二步：轮到')
  })
})
