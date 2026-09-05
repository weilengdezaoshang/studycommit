import { describe, expect, it } from 'vitest'
import {
  createPaperInputSchema as rpcCreateInput,
  listPapersInputSchema as rpcListInput,
  paperCommandSchema as rpcCommand,
  paperPageSchema as rpcPage,
  paperSchema as rpcPaperSchema,
  updatePaperInputSchema as rpcUpdateInput,
  updatePaperQuestionInputSchema as rpcQuestionInput,
} from '@studycommit/rpc-contracts/papers'
import {
  createPaperInputSchema,
  listPapersInputSchema,
  paperCommandSchema,
  paperPageSchema,
  paperSchema,
  updatePaperInputSchema,
  updatePaperQuestionInputSchema,
} from './paper.schema'

/** 两份纸页契约的守护样例:新增字段时必须同时更新 packages/rpc-contracts/src/papers.ts。 */
const paperFixture = {
  id: '0b8f3c64-6e2a-4a5d-9d0a-2f0f5d3a1b21',
  content: '为什么 React 的状态更新不是立即生效？',
  status: 'inbox',
  topicId: null,
  version: 3,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-02T09:30:00.000Z',
  deletedAt: null,
  hasQuestion: true,
  isQuestionResolved: false,
  questionStatus: 'thinking',
  questionText: '批处理和调度分别解决了什么问题？',
  understandingText: null,
  questionResolvedAt: null,
}

describe('paper schema', () => {
  it('与 rpc-contracts 的纸页契约解析结果保持一致', () => {
    expect(paperSchema.parse(paperFixture)).toEqual(rpcPaperSchema.parse(paperFixture))
  })

  it('分页与输入契约和 rpc-contracts 解析结果保持一致', () => {
    const pageFixture = {
      items: [paperFixture],
      pageInfo: { hasNextPage: false, nextCursor: null },
    }
    expect(paperPageSchema.parse(pageFixture)).toEqual(rpcPage.parse(pageFixture))

    const command = { id: paperFixture.id, version: 2 }
    expect(paperCommandSchema.parse(command)).toEqual(rpcCommand.parse(command))

    const createInput = {
      content: '一段记录',
      questionText: '为什么',
      understandingText: '因为有批处理',
    }
    expect(createPaperInputSchema.parse(createInput)).toEqual(rpcCreateInput.parse(createInput))

    const listInput = { questionStatus: 'thinking', limit: '5' }
    expect(listPapersInputSchema.parse(listInput)).toEqual(rpcListInput.parse(listInput))

    const updateInput = { id: paperFixture.id, version: 1, content: '  新正文  ' }
    expect(updatePaperInputSchema.parse(updateInput)).toEqual(rpcUpdateInput.parse(updateInput))

    const questionInput = {
      id: paperFixture.id,
      version: 1,
      status: 'thinking',
      questionText: '  新问题  ',
    }
    expect(updatePaperQuestionInputSchema.parse(questionInput)).toEqual(
      rpcQuestionInput.parse(questionInput),
    )
  })

  it('缺省的问题字段由默认值补齐', () => {
    const { questionStatus, questionText, understandingText, questionResolvedAt, ...rest } =
      paperFixture
    void questionStatus
    void questionText
    void understandingText
    void questionResolvedAt
    expect(paperSchema.parse(rest)).toMatchObject({
      questionStatus: 'none',
      questionText: null,
      understandingText: null,
      questionResolvedAt: null,
    })
  })
})
