import type { ReactNode } from 'react'

/**
 * 关键词高亮(R62/R63):忽略大小写把命中片段包上 <mark>;
 * 无命中或空关键词时原样返回文本节点。
 */
export function highlightKeyword(text: string, keyword: string): ReactNode[] {
  if (!keyword) {
    return [text]
  }
  const lowerText = text.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  while (from <= text.length) {
    const hit = lowerText.indexOf(lowerKeyword, from)
    if (hit < 0) {
      parts.push(text.slice(from))
      break
    }
    if (hit > from) {
      parts.push(text.slice(from, hit))
    }
    parts.push(
      <mark key={`${hit}-${lowerKeyword}`} className="search-hit">
        {text.slice(hit, hit + lowerKeyword.length)}
      </mark>,
    )
    from = hit + lowerKeyword.length
  }
  return parts
}
