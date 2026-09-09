import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { highlightKeyword } from './highlight'

function textOf(nodes: React.ReactNode[]): string {
  return nodes
    .map((node) =>
      typeof node === 'string' ? node : (node as { props: { children: string } }).props.children,
    )
    .join('')
}

describe('搜索关键词高亮', () => {
  it('忽略大小写切分命中片段并保留原文顺序', () => {
    const nodes = highlightKeyword('理解不是一次完成的，Re理解', '理解')
    expect(nodes.filter((node) => typeof node !== 'string')).toHaveLength(2)
    expect(textOf(nodes)).toBe('理解不是一次完成的，Re理解')
  })

  it('无命中或空关键词时原样返回', () => {
    expect(highlightKeyword('普通记录', '堆')).toEqual(['普通记录'])
    expect(highlightKeyword('普通记录', '')).toEqual(['普通记录'])
  })

  it('渲染出的 mark 标记带上 search-hit 类名', () => {
    const { container } = render(<p>{highlightKeyword('回顾理解', '理解')}</p>)
    const marks = container.querySelectorAll('mark.search-hit')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('理解')
  })
})
