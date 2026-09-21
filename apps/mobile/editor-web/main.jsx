import React, { useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { EditorContent } from '@tiptap/react'
import { Markdown } from '@tiptap/markdown'
import CodeBlock from '@tiptap/extension-code-block'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { TenTapStartKit, useTenTap } from '@10play/tentap-editor/web'
import { shouldInsertMarkdownPaste } from '@studycommit/rpc-contracts/rich-text'

// 浏览器开发预览补齐原本由原生 WebView 注入的配置；生产内核仍由 TenTap 注入。
const browserPreview = import.meta.env.MODE === 'browser-preview' && !window.ReactNativeWebView
if (browserPreview) {
  const bridges = TenTapStartKit.filter(
    (bridge) => !['image', 'taskList', 'color', 'highlight'].includes(bridge.name),
  )
  window.whiteListBridgeExtensions = bridges.map((bridge) => bridge.name)
  window.bridgeExtensionConfigMap = JSON.stringify(
    Object.fromEntries(
      bridges.map((bridge) => [
        bridge.name,
        { optionsConfig: bridge.config, extendConfig: bridge.extendConfig },
      ]),
    ),
  )
  window.editable = true
  window.platform = 'web'
  window.initialContent =
    '<h2>把看懂变成记住</h2><p>今天试试<strong>主动回想</strong>，而不只是重读。</p><ul><li><p>合上书，用自己的话讲一遍</p></li><li><p>回去补上没讲清楚的地方</p></li></ul><blockquote><p>能讲清楚，才知道自己懂了多少。</p></blockquote>'
  const {
    studyCommitMistBlueColors: colors,
    spacing,
    radii,
  } = await import('@studycommit/design-tokens')
  for (const [name, value] of Object.entries(colors))
    document.documentElement.style.setProperty(`--${name}`, value)
  document.documentElement.style.setProperty('--space', `${spacing.md}px`)
  document.documentElement.style.setProperty('--radius', `${radii.md}px`)
  await import('./preview.css')
}

function Editor() {
  const plainPaste = useRef(false)
  const bridges = TenTapStartKit.filter(
    (bridge) =>
      !window.whiteListBridgeExtensions || window.whiteListBridgeExtensions.includes(bridge.name),
  )
  // 两种列表桥自带 ListItem 依赖；由独立的 ListItem 桥统一注册，避免重复扩展。
  const uniqueBridges = bridges.map((bridge) => {
    if (!['bulletList', 'orderedList'].includes(bridge.name)) return bridge
    const copy = bridge.clone()
    copy.tiptapExtensionDeps = []
    return copy
  })
  const editor = useTenTap({
    bridges: uniqueBridges,
    tiptapOptions: {
      extensions: [CodeBlock, HorizontalRule, Markdown],
      editorProps: {
        attributes: { role: 'textbox', 'aria-label': '正文', 'aria-multiline': 'true' },
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
          if (!insertMarkdown || !text) return false
          editor.commands.insertContent(text, { contentType: 'markdown' })
          return true
        },
      },
    },
  })
  return (
    <>
      {browserPreview && (
        <header className="preview-header">
          <h1>开始记录</h1>
          <p>移动端富文本内核 · 浏览器交互预览</p>
          <nav aria-label="正文格式">
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              标题
            </button>
            <button onClick={() => editor.chain().focus().toggleBold().run()}>粗体</button>
            <button onClick={() => editor.chain().focus().toggleBulletList().run()}>列表</button>
            <button onClick={() => editor.chain().focus().toggleBlockquote().run()}>引用</button>
            <button onClick={() => editor.chain().focus().undo().run()}>撤销</button>
          </nav>
        </header>
      )}
      <EditorContent
        editor={editor}
        className={window.dynamicHeight ? 'dynamic-height' : undefined}
      />
      {browserPreview && (
        <footer>支持 Markdown 快捷输入和粘贴。此入口用于编辑器预览，内容不会保存到账号。</footer>
      )}
    </>
  )
}
// 原生 WebView 注入可能晚于脚本执行；必须等草稿和桥配置就绪后再创建编辑器。
// initialContent 只在创建时读取，提前创建空文档会使后到的草稿失效。
const mountEditor = () => createRoot(document.getElementById('root')).render(<Editor />)
if (browserPreview || window.contentInjected) {
  mountEditor()
} else {
  const injectionTimer = setInterval(() => {
    if (!window.contentInjected) return
    clearInterval(injectionTimer)
    mountEditor()
  }, 10)
  window.addEventListener('pagehide', () => clearInterval(injectionTimer), { once: true })
}
