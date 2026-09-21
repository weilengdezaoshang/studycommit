/** @jest-environment jsdom */
import { editorHtml } from './rich-editor-bundle'

const script = editorHtml.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/)?.[1]
const nativeWindow = window as unknown as Record<string, unknown>
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 执行实际打包的编辑内核，覆盖屏幕测试中被替代的 WebView 初始化边界。 */
describe('RichTextEditor bootstrap', () => {
  it('等待原生草稿注入后再创建编辑器并恢复正文', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    const postMessage = jest.fn()
    nativeWindow.ReactNativeWebView = { postMessage }
    nativeWindow.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
    nativeWindow.bridgeExtensionConfigMap = JSON.stringify(
      Object.fromEntries(
        [
          'doc',
          'bold',
          'italic',
          'strike',
          'underline',
          'heading',
          'bulletList',
          'orderedList',
          'listItem',
          'blockquote',
          'code',
          'link',
          'history',
          'placeholder',
        ].map((name) => [name, {}]),
      ),
    )
    nativeWindow.contentInjected = false
    delete nativeWindow.initialContent
    expect(script).toBeDefined()
    window.eval(script!)
    await pause(100)
    expect(document.querySelector('.tiptap')).toBeNull()
    nativeWindow.initialContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '退出前保存的正文' }] }],
    }
    nativeWindow.editable = true
    nativeWindow.platform = 'ios'
    nativeWindow.contentInjected = true
    await pause(150)
    expect(document.querySelector('.tiptap')?.textContent).toBe('退出前保存的正文')
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'action',
          payload: { type: 'get-json', payload: { messageId: 'verify-draft' } },
        }),
      }),
    )
    const replies = postMessage.mock.calls.map(([message]) => JSON.parse(message))
    expect(replies).toContainEqual({
      type: 'send-json-back',
      payload: { messageId: 'verify-draft', content: nativeWindow.initialContent },
    })
  })
})
