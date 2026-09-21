import { NotebookSelect } from '../../components/notebook/NotebookSelect'
import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import {
  plainTextDocument,
  RICH_TEXT_HEADING_LEVELS,
  richTextDocumentSchema,
  richTextPlainText,
  shouldInsertMarkdownPaste,
  type RichTextDocument,
} from '@studycommit/rpc-contracts/rich-text'
import './secondary-pages.css'

export function RichTextEditor({
  initialText = '',
  initialDocument,
  onChange,
  onValidityChange,
  disabled = false,
}: {
  initialText?: string
  initialDocument?: RichTextDocument | null
  onChange: (value: { content: string; contentDocument: RichTextDocument }) => void
  disabled?: boolean
  onValidityChange?: (valid: boolean) => void
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const plainPaste = useRef(false)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [...RICH_TEXT_HEADING_LEVELS] },
        link: { openOnClick: false, protocols: ['http', 'https', 'mailto'] },
      }),
      Markdown,
    ],
    content: initialDocument?.doc ?? plainTextDocument(initialText),
    editable: !disabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': '正文',
        'aria-multiline': 'true',
        'data-placeholder': '记下一个想法…',
      },
      handleKeyDown: (_view, event) => {
        plainPaste.current =
          event.shiftKey && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v'
        return false
      },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain')
        const html = event.clipboardData?.getData('text/html')
        const insertMarkdown = shouldInsertMarkdownPaste(text, html, plainPaste.current)
        plainPaste.current = false
        if (!insertMarkdown || !text) {
          return false
        }
        editor?.commands.insertContent(text, { contentType: 'markdown' })
        return true
      },
    },
    onUpdate: ({ editor: current }) => {
      const result = richTextDocumentSchema.safeParse({ version: 1, doc: current.getJSON() })
      onValidityChange?.(result.success)
      if (!result.success) {
        setError('文档包含暂不支持的格式，请撤销最近的格式操作')
        return
      }
      setError('')
      onChange({ content: richTextPlainText(result.data.doc), contentDocument: result.data })
    },
  })
  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            list: current.isActive('bulletList'),
            ordered: current.isActive('orderedList'),
            quote: current.isActive('blockquote'),
            code: current.isActive('codeBlock'),
            heading:
              RICH_TEXT_HEADING_LEVELS.find((level) => current.isActive('heading', { level })) ?? 0,
            undo: current.can().undo(),
            redo: current.can().redo(),
          }
        : null,
  })
  if (!editor || !state) {
    return <p role="status">正在打开编辑器…</p>
  }
  const actions = [
    {
      label: '粗体',
      icon: 'B',
      active: state.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: '斜体',
      icon: '𝘐',
      active: state.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: '无序列表',
      icon: '☷',
      active: state.list,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: '有序列表',
      icon: '1.',
      active: state.ordered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: '引用',
      icon: '❞',
      active: state.quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: '代码块',
      icon: '</>',
      active: state.code,
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ]
  return (
    <div className="rich-editor" aria-busy={disabled}>
      <div className="rich-toolbar" role="toolbar" aria-label="正文格式">
        <NotebookSelect
          aria-label="段落格式"
          value={state.heading}
          disabled={disabled}
          onValueChange={(value) => {
            const level = Number(value)
            if (level === 0) {
              editor.chain().focus().setParagraph().run()
            } else {
              editor
                .chain()
                .focus()
                .setHeading({ level: level as 1 | 2 | 3 })
                .run()
            }
          }}
        >
          <option value={0}>正文</option>
          <option value={1}>标题 1</option>
          <option value={2}>标题 2</option>
          <option value={3}>标题 3</option>
        </NotebookSelect>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.label}
            aria-label={action.label}
            aria-pressed={action.active}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={action.run}
          >
            {action.icon}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          aria-label="插入链接"
          title="插入链接"
          onClick={() => {
            setUrl(editor.getAttributes('link').href ?? '')
            setLinkOpen(!linkOpen)
          }}
        >
          ↗
        </button>
        <button
          type="button"
          aria-label="撤销"
          title="撤销"
          disabled={disabled || !state.undo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label="重做"
          title="重做"
          disabled={disabled || !state.redo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          ↷
        </button>
        <details className="rich-help">
          <summary>语法帮助</summary>
          <p>
            <code># 空格</code> 标题 · <code>- 空格</code> 列表 · <code>&gt; 空格</code> 引用 ·{' '}
            <code>**文字**</code> 粗体 · 三个反引号后空格开启代码块。使用撤销恢复刚输入的语法。
          </p>
        </details>
      </div>
      {linkOpen && (
        <form
          className="rich-link"
          onSubmit={(event) => {
            event.preventDefault()
            if (url && !/^(https?:\/\/|mailto:)/i.test(url)) {
              setError('请输入 http、https 或 mailto 链接')
              return
            }
            if (url) {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
            } else {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
            }
            setLinkOpen(false)
            setError('')
          }}
        >
          <label>
            链接地址
            <input
              autoFocus
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
            />
          </label>
          <button type="submit">应用</button>
          <button type="button" onClick={() => setLinkOpen(false)}>
            取消
          </button>
        </form>
      )}
      <EditorContent editor={editor} className="rich-content" />
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export function RichTextReader({
  content,
  document,
}: {
  content: string
  document?: RichTextDocument | null
}) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          link: {
            openOnClick: true,
            HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
          },
        }),
      ],
      content: document?.doc ?? plainTextDocument(content),
      editable: false,
      editorProps: { attributes: { 'aria-label': '记录正文' } },
    },
    [content, document],
  )
  return <EditorContent editor={editor} className="rich-content rich-content--reader" />
}
