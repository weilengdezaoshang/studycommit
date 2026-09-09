import { describe, expect, it } from 'vitest'
import {
  SEARCH_LOCAL_RESULT_LIMIT,
  filterLocalSearchRows,
  mergeSearchRows,
  searchRowKey,
  toServerSearchRows,
} from './index'

function sourceWith(
  papers: Array<{
    id: string
    content: string
    topicId?: string | null
    deletedAt?: string | null
  }>,
  topics: Array<{ id: string; name: string }>,
) {
  return {
    papers: papers.map((paper) => ({
      id: paper.id,
      content: paper.content,
      createdAt: '2026-09-05T02:00:00.000Z',
      topicId: paper.topicId ?? null,
      deletedAt: paper.deletedAt ?? null,
    })),
    topics,
  }
}

describe('search rows', () => {
  it('本地过滤按箱子在前、纸页在后排列', () => {
    const source = sourceWith(
      [
        { id: 'p-1', content: '今天复习了小顶堆的建堆过程' },
        { id: 'p-2', content: '与栈无关的记录' },
      ],
      [{ id: 't-1', name: '堆与优先队列' }],
    )
    const rows = filterLocalSearchRows(source, '堆')
    expect(rows.map(searchRowKey)).toEqual(['topic-t-1', 'paper-p-1'])
  })

  it('本地过滤忽略大小写并排除软删纸页', () => {
    const source = sourceWith(
      [
        { id: 'p-1', content: 'Review 二叉树' },
        { id: 'p-2', content: 'review 删除的纸页', deletedAt: '2026-09-06T00:00:00.000Z' },
      ],
      [],
    )
    const rows = filterLocalSearchRows(source, 'REVIEW')
    expect(rows.map((row) => row.id)).toEqual(['p-1'])
  })

  it('本地过滤的箱子计数不包含软删纸页', () => {
    const source = sourceWith(
      [
        { id: 'p-1', content: '堆', topicId: 't-1' },
        { id: 'p-2', content: '堆', topicId: 't-1', deletedAt: '2026-09-06T00:00:00.000Z' },
      ],
      [{ id: 't-1', name: '堆专题' }],
    )
    const rows = filterLocalSearchRows(source, '堆专题')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'topic', count: 1 })
  })

  it('本地过滤空关键词与无命中都返回空数组', () => {
    const source = sourceWith([{ id: 'p-1', content: '内容' }], [{ id: 't-1', name: '主题' }])
    expect(filterLocalSearchRows(source, '')).toEqual([])
    expect(filterLocalSearchRows(source, '不存在的关键词')).toEqual([])
  })

  it('本地过滤每类结果最多保留 10 条', () => {
    const papers = Array.from({ length: 14 }, (_, index) => ({
      id: `p-${index}`,
      content: `命中内容 ${index}`,
      createdAt: '2026-09-05T02:00:00.000Z',
      topicId: null,
      deletedAt: null,
    }))
    const topics = Array.from({ length: 12 }, (_, index) => ({
      id: `t-${index}`,
      name: `主题 ${index}`,
    }))
    const rows = filterLocalSearchRows({ papers, topics }, '命中')
    expect(rows.filter((row) => row.type === 'paper')).toHaveLength(SEARCH_LOCAL_RESULT_LIMIT)
    const topicRows = filterLocalSearchRows({ papers, topics }, '主题')
    expect(topicRows.filter((row) => row.type === 'topic')).toHaveLength(SEARCH_LOCAL_RESULT_LIMIT)
  })

  it('服务端结果映射为箱子在前、纸页在后的展示行', () => {
    const rows = toServerSearchRows({
      papers: {
        items: [
          {
            id: 'p-1',
            content: '服务端命中的正文',
            createdAt: '2026-09-05T02:00:00.000Z',
          },
        ],
      },
      topics: [{ id: 't-1', name: '云端箱子', paperCount: 3 }],
    })
    expect(rows).toEqual([
      { type: 'topic', id: 't-1', name: '云端箱子', count: 3 },
      { type: 'paper', id: 'p-1', title: '2026-09-05', detail: '服务端命中的正文' },
    ])
  })

  it('合并结果时服务端优先且本地重复行被去重', () => {
    const serverRows = [
      { type: 'topic' as const, id: 't-1', name: '堆专题', count: 2 },
      { type: 'paper' as const, id: 'p-1', title: '2026-09-05', detail: '云端正文' },
    ]
    const localRows = [
      { type: 'paper' as const, id: 'p-1', title: '2026-09-05', detail: '云端正文' },
      { type: 'paper' as const, id: 'p-2', title: '2026-09-06', detail: '仅本机命中' },
    ]
    const merged = mergeSearchRows(serverRows, localRows)
    expect(merged.map((row) => row.id)).toEqual(['t-1', 'p-1', 'p-2'])
  })
})
