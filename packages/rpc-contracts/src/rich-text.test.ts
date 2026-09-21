import { describe, expect, it } from 'vitest'
import {
  plainTextDocument,
  richTextDocumentSchema,
  richTextPlainText,
  shouldInsertMarkdownPaste,
} from './rich-text.js'
import { createPaperInputSchema } from './papers.js'

describe('富文本文档', () => {
  it('保留标题列表粗体引用并生成纯文本投影', () => {
    const value = {
      version: 1,
      doc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '标题' }] },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '重点', marks: [{ type: 'bold' }] }],
                  },
                ],
              },
            ],
          },
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '引用' }] }],
          },
        ],
      },
    }
    const parsed = richTextDocumentSchema.parse(value)
    expect(richTextPlainText(parsed.doc)).toBe('标题\n重点\n引用')
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(value)
    expect(
      createPaperInputSchema.parse({ content: '标题\n重点\n引用', contentDocument: value })
        .contentDocument,
    ).toEqual(value)
  })
  it('旧记录中的星号和井号仍是普通文本', () => {
    const source = '# 不是标题\n**不是粗体**'
    const doc = plainTextDocument(source)
    expect(richTextPlainText(doc)).toBe(source)
    expect(doc.content?.[0].type).toBe('paragraph')
    expect(createPaperInputSchema.parse({ content: source }).contentDocument).toBeUndefined()
  })
  it('拒绝脚本链接和未经支持的节点', () => {
    expect(
      richTextDocumentSchema.safeParse({
        version: 1,
        doc: {
          type: 'doc',
          content: [
            {
              type: 'text',
              text: '链接',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      }).success,
    ).toBe(false)
    expect(richTextDocumentSchema.safeParse({ version: 1, doc: { type: 'iframe' } }).success).toBe(
      false,
    )
  })
  it('拒绝富文本与搜索正文不一致的保存载荷', () => {
    expect(
      createPaperInputSchema.safeParse({
        content: '其他内容',
        contentDocument: { version: 1, doc: plainTextDocument('原文') },
      }).success,
    ).toBe(false)
  })
  it('仅把 Markdown 纯文本粘贴交给编辑器', () => {
    expect(shouldInsertMarkdownPaste('# 标题', undefined, false)).toBe(true)
    expect(shouldInsertMarkdownPaste('# 标题', '<p>标题</p>', false)).toBe(false)
    expect(shouldInsertMarkdownPaste('| a | b |', undefined, false)).toBe(false)
    expect(shouldInsertMarkdownPaste('# 标题', undefined, true)).toBe(false)
  })
  it('拒绝过深文档而不溢出调用栈', () => {
    let node: unknown = { type: 'paragraph' }
    for (let i = 0; i < 100; i++) {
      node = { type: 'blockquote', content: [node] }
    }
    expect(richTextDocumentSchema.safeParse({ version: 1, doc: node }).success).toBe(false)
  })
})
