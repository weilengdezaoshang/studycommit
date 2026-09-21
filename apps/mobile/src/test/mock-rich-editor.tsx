import { useImperativeHandle, useState, type ComponentProps } from 'react'
import { TextInput } from 'react-native'
import { plainTextDocument } from '@studycommit/rpc-contracts/rich-text'
import type { RichTextEditor as EditorComponent } from '../components/RichTextEditor'

/** 屏幕测试替代 WebView 边界；真实编辑内核另通过浏览器验证。 */
export function RichTextEditor({
  initialText,
  initialDocument,
  editorRef,
  onChange,
}: ComponentProps<typeof EditorComponent>) {
  const [content, setContent] = useState(initialText)
  const [contentDocument, setDocument] = useState(
    initialDocument ?? { version: 1 as const, doc: plainTextDocument(initialText) },
  )
  useImperativeHandle(editorRef, () => ({ read: async () => ({ content, contentDocument }) }))
  return (
    <TextInput
      multiline
      placeholder="写点什么吧……"
      value={content}
      onChangeText={(text) => {
        const document = { version: 1 as const, doc: plainTextDocument(text) }
        setContent(text)
        setDocument(document)
        onChange?.({ content: text, contentDocument: document })
      }}
    />
  )
}
