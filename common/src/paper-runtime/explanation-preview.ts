import { parse, Allow } from 'partial-json'

/** 未完成的 JSON 仅用于预览，最终结果仍由完整契约校验。 */
export function explanationPreview(source: string): string {
  const start = source.indexOf('{')
  if (start < 0) {
return ''
}
  try {
    const value = parse(
      source.slice(start).replace(/```\s*$/, ''),
      Allow.OBJ | Allow.ARR | Allow.STR,
    )
    const view = value?.view
    if (!view || typeof view !== 'object') {
return ''
}
    const text = (value: unknown) => (typeof value === 'string' ? value : '')
    const lines: string[] = []
    if (Array.isArray(view.steps)) {
      for (const step of view.steps.slice(0, 6)) {
        if (!step || typeof step !== 'object') {
continue
}
        lines.push(
          [text(step.title ?? step.action), text(step.detail ?? step.reason)]
            .filter(Boolean)
            .join('：'),
        )
      }
    }
    if (Array.isArray(view.items)) {
      for (const item of view.items.slice(0, 5)) {
        if (!item || typeof item !== 'object') {
continue
}
        lines.push(
          [text(item.aspect), [text(item.a), text(item.b)].filter(Boolean).join(' / ')]
            .filter(Boolean)
            .join('：'),
        )
      }
    }
    if (text(view.definition)) {
lines.push(view.definition)
}
    if (text(view.counterexample)) {
lines.push(`反例：${view.counterexample}`)
}
    if (text(value.example)) {
lines.push(`例子：${value.example}`)
}
    return lines.filter(Boolean).join('\n\n')
  } catch {
    return ''
  }
}
