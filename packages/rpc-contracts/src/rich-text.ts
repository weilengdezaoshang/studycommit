import { z } from 'zod'

export interface RichTextNode {
  type: string
  text?: string
  attrs?: Record<string, string | number | boolean | null>
  marks?: { type: string; attrs?: Record<string, string | number | boolean | null> }[]
  content?: RichTextNode[]
}

export interface RichTextDocument {
  version: 1
  doc: RichTextNode
}

const attrs = z
  .record(z.string(), z.union([z.string().max(2048), z.number(), z.boolean(), z.null()]))
  .refine(
    (value) => !value.href || /^(https?:\/\/|mailto:)/i.test(String(value.href)),
    '链接仅支持 http、https 或 mailto',
  )
const nodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.enum([
      'doc',
      'paragraph',
      'text',
      'heading',
      'bulletList',
      'orderedList',
      'listItem',
      'blockquote',
      'codeBlock',
      'hardBreak',
      'horizontalRule',
    ]),
    text: z.string().max(200_000).optional(),
    attrs: attrs.optional(),
    marks: z
      .array(
        z.object({
          type: z.enum(['bold', 'italic', 'strike', 'underline', 'code', 'link']),
          attrs: attrs.optional(),
        }),
      )
      .max(6)
      .optional(),
    content: z.array(nodeSchema).max(5000).optional(),
  }),
)

/** 限制深度与节点数，再进入递归校验，避免不可信文档耗尽调用栈。 */
export const richTextDocumentSchema: z.ZodType<RichTextDocument, RichTextDocument> = z.preprocess(
  (value: RichTextDocument, ctx) => {
    const queue: { value: unknown; depth: number }[] = [{ value, depth: 0 }]
    let count = 0
    while (queue.length) {
      const item = queue.pop()!
      if (++count > 50_000 || item.depth > 32) {
        ctx.addIssue({ code: 'custom', message: '文档层级或节点数量超出限制' })
        return z.NEVER
      }
      if (item.value && typeof item.value === 'object') {
        for (const child of Object.values(item.value)) {
          queue.push({ value: child, depth: item.depth + 1 })
        }
      }
    }
    return value
  },
  z.object({
    version: z.literal(1),
    doc: nodeSchema.refine((node) => node.type === 'doc', '缺少文档根节点'),
  }),
) as z.ZodType<RichTextDocument, RichTextDocument>

/** 两端共享纯文本投影：列表/搜索/字数/问题兜底均使用同一份内容。 */
export function richTextPlainText(node: RichTextNode): string {
  if (node.type === 'text') {
    return node.text ?? ''
  }
  if (node.type === 'hardBreak') {
    return '\n'
  }
  const children = node.content ?? []
  const inline = ['paragraph', 'heading', 'codeBlock'].includes(node.type)
  return children.map(richTextPlainText).join(inline ? '' : '\n')
}

export function plainTextDocument(text: string): RichTextNode {
  return {
    type: 'doc',
    content: text
      .split('\n')
      .map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })),
  }
}

export const RICH_TEXT_HEADING_LEVELS = [1, 2, 3] as const

const UNSUPPORTED_PASTE = /(^|\n)\s*(\||<\/?[a-zA-Z]|\$\$)/
const MARKDOWN_PASTE = /(^|\n)(#{1,3} |[-*>] |\d+\. |```)|\*\*.+\*\*/

/** 两端编辑器共用的粘贴判断：表格/HTML/公式保持原文，其余 Markdown 交给 TipTap。 */
export function shouldInsertMarkdownPaste(
  text: string | undefined,
  html: string | undefined,
  plainPaste: boolean,
): boolean {
  if (!text || UNSUPPORTED_PASTE.test(text) || plainPaste || html) {
    return false
  }
  return MARKDOWN_PASTE.test(text)
}
