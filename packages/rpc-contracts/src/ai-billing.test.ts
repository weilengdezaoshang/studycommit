import { describe, expect, it } from 'vitest'
import { aiGetRunOutputSchema, aiQuoteOutputSchema, aiStartRunOutputSchema } from './ai.js'

describe('ai billing contract', () => {
  it('报价输出携带价格版本与余额快照', () => {
    const output = aiQuoteOutputSchema.parse({
      action: 'paper_explain',
      priceCredits: 5,
      priceVersion: 3,
      balance: { available: 40, reserved: 5 },
    })
    expect(output.priceVersion).toBe(3)
  })

  it('受理输出要求对账截止时间与冻结数量', () => {
    const output = aiStartRunOutputSchema.parse({
      runId: crypto.randomUUID(),
      runPhase: 'queued',
      priceCredits: 5,
      priceVersion: 3,
      reservedCredits: 5,
      deadlineAt: new Date().toISOString(),
    })
    expect(output.reservedCredits).toBe(5)
  })

  it('运行查询输出允许结果为空并带结算状态', () => {
    const output = aiGetRunOutputSchema.parse({
      runId: crypto.randomUUID(),
      status: 'pending',
      runPhase: 'running',
      output: null,
      error: null,
      settlement: { state: 'reserved', credits: 5 },
      balance: { available: 35, reserved: 5 },
    })
    expect(output.output).toBeNull()
    expect(output.settlement?.state).toBe('reserved')
  })

  it('非法运行阶段被拒绝', () => {
    expect(
      aiStartRunOutputSchema.safeParse({
        runId: crypto.randomUUID(),
        runPhase: 'teleporting',
        priceCredits: 5,
        priceVersion: 3,
        reservedCredits: 5,
        deadlineAt: new Date().toISOString(),
      }).success,
    ).toBe(false)
  })
})
