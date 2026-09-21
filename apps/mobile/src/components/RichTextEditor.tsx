import { editorHtml } from './rich-editor-bundle'
import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { RichText, useEditorBridge, useBridgeState, TenTapStartKit } from '@10play/tentap-editor'
import {
  motion,
  radii,
  spacing,
  typography,
  studyCommitMistBlueColors as colors,
} from '@studycommit/design-tokens'
import {
  plainTextDocument,
  richTextDocumentSchema,
  richTextPlainText,
  type RichTextDocument,
} from '@studycommit/rpc-contracts/rich-text'

export type RichTextValue = { content: string; contentDocument: RichTextDocument }
export type RichTextEditorHandle = { read: () => Promise<RichTextValue> }
const bridges = TenTapStartKit.filter(
  (bridge) => !['image', 'taskList', 'color', 'highlight'].includes(bridge.name),
)
const editorCss = `body{background:${colors.paper};color:${colors.ink};font-family:-apple-system,system-ui,sans-serif;font-size:${typography.body.fontSize}px;line-height:${typography.body.lineHeight}px;margin:0} .tiptap{padding:0;outline:0;min-height:120px}p{margin:0 0 ${spacing.md}px}h1{font-size:${typography.title.fontSize}px}h2{font-size:${typography.heading.fontSize}px}h3{font-size:${typography.subheading.fontSize}px}h1,h2,h3{line-height:1.4;margin:${spacing.md}px 0}blockquote{margin:${spacing.md}px 0;padding-left:${spacing.md}px;border-left:3px solid ${colors.action};color:${colors.muted}}ul,ol{padding-left:${spacing.lg}px}li p{margin-bottom:${spacing.xs}px}pre,code{background:${colors.surfaceSoft};font-family:monospace}pre{padding:${spacing.md}px;white-space:pre-wrap}a{color:${colors.action}}`

export function RichTextEditor({
  initialText,
  initialDocument,
  onChange,
  onFocusChange,
  editorRef,
  readOnly = false,
  disabled = false,
  showFormatting = false,
}: {
  initialText: string
  initialDocument?: RichTextDocument | null
  onChange?: (value: RichTextValue) => void
  onFocusChange?: (focused: boolean) => void
  editorRef?: Ref<RichTextEditorHandle>
  readOnly?: boolean
  disabled?: boolean
  showFormatting?: boolean
}) {
  const [error, setError] = useState('')
  const [more, setMore] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const generation = useRef(0)
  const mounted = useRef(true)
  const editor = useEditorBridge({
    customSource: editorHtml,
    initialContent: initialDocument?.doc ?? plainTextDocument(initialText),
    bridgeExtensions: bridges,
    editable: !readOnly && !disabled,
    autofocus: false,
    dynamicHeight: readOnly,
    avoidIosKeyboard: false,
    theme: {
      webview: { backgroundColor: colors.paper },
      webviewContainer: { backgroundColor: colors.paper },
    },
    onChange: () => {
      const request = ++generation.current
      void read()
        .then((value) => {
          if (mounted.current && request === generation.current) {
            onChange?.(value)
            setError('')
          }
        })
        .catch(() => {
          if (mounted.current) {
            setError('编辑内容读取失败，请重试保存')
          }
        })
    },
  })
  const state = useBridgeState(editor)
  async function read(): Promise<RichTextValue> {
    if (!editor.getEditorState().isReady) {
      throw new Error('编辑器尚未准备好')
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const json = await Promise.race([
      editor.getJSON(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('读取超时')), 5000)
      }),
    ]).finally(() => clearTimeout(timer))
    const contentDocument = richTextDocumentSchema.parse({ version: 1, doc: json })
    return { content: richTextPlainText(contentDocument.doc), contentDocument }
  }
  useImperativeHandle(editorRef, () => ({
    read: async () => {
      ++generation.current
      return read()
    },
  }))
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const configureEditor = useEffectEvent(() => {
    editor.injectCSS(editorCss)
    editor.setEditable(!readOnly && !disabled)
  })
  useEffect(() => {
    if (state.isReady) {
      configureEditor()
    }
  }, [readOnly, disabled, state.isReady])
  useEffect(() => {
    onFocusChange?.(state.isFocused)
  }, [state.isFocused, onFocusChange])
  const actions = [
    {
      label: '标题 1',
      text: 'H₁',
      active: state.headingLevel === 1,
      run: () => editor.toggleHeading(1),
    },
    {
      label: '标题 2',
      text: 'H₂',
      active: state.headingLevel === 2,
      run: () => editor.toggleHeading(2),
    },
    {
      label: '标题 3',
      text: 'H₃',
      active: state.headingLevel === 3,
      run: () => editor.toggleHeading(3),
    },
    { label: '粗体', text: 'B', active: state.isBoldActive, run: () => editor.toggleBold() },
    {
      label: '列表',
      text: '☷',
      active: state.isBulletListActive,
      run: () => editor.toggleBulletList(),
    },
    {
      label: '引用',
      text: '❞',
      active: state.isBlockquoteActive,
      run: () => editor.toggleBlockquote(),
    },
    ...(more
      ? [
          {
            label: '斜体',
            text: '𝘐',
            active: state.isItalicActive,
            run: () => editor.toggleItalic(),
          },
          {
            label: '有序列表',
            text: '1.',
            active: state.isOrderedListActive,
            run: () => editor.toggleOrderedList(),
          },
          {
            label: '行内代码',
            text: '</>',
            active: state.isCodeActive,
            run: () => editor.toggleCode(),
          },
          {
            label: '链接',
            text: '↗',
            active: state.isLinkActive,
            run: () => {
              setUrl(state.activeLink ?? '')
              setLinkOpen(true)
            },
          },
          { label: '撤销', text: '↶', disabled: !state.canUndo, run: () => editor.undo() },
          { label: '重做', text: '↷', disabled: !state.canRedo, run: () => editor.redo() },
        ]
      : []),
  ]
  return (
    <View style={readOnly ? undefined : styles.container}>
      <RichText editor={editor} style={readOnly ? styles.reader : styles.editor} />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {!readOnly && linkOpen && (
        <View style={styles.linkForm}>
          <TextInput
            accessibilityLabel="链接地址"
            placeholder="https://"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            style={styles.linkInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="应用链接"
            style={styles.button}
            onPress={() => {
              const value = url.trim()
              if (value && !/^(https?:\/\/|mailto:)/i.test(value)) {
                setError('请输入 http、https 或 mailto 链接')
                return
              }
              editor.setLink(value)
              setLinkOpen(false)
              setError('')
            }}
          >
            <Text style={styles.label}>应用</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="取消链接"
            style={styles.button}
            onPress={() => setLinkOpen(false)}
          >
            <Text style={styles.label}>取消</Text>
          </Pressable>
        </View>
      )}
      {!readOnly && (state.isFocused || showFormatting) && (
        <View style={styles.toolbar}>
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
          >
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{
                  selected: 'active' in action ? action.active : false,
                  disabled: disabled || ('disabled' in action && action.disabled),
                }}
                disabled={disabled || ('disabled' in action && action.disabled)}
                onPress={action.run}
                style={[styles.button, 'active' in action && action.active && styles.selected]}
              >
                <Text style={styles.label}>{action.text}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="更多格式"
              onPress={() => setMore(!more)}
              style={styles.button}
            >
              <Text style={styles.label}>···</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="收起键盘"
              onPress={() => editor.blur()}
              style={styles.button}
            >
              <Text style={styles.label}>⌄</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 140 },
  editor: { flex: 1, backgroundColor: colors.paper },
  reader: { backgroundColor: colors.paper },
  linkForm: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  linkInput: {
    flex: 1,
    minHeight: 44,
    color: colors.ink,
    borderBottomWidth: 1,
    borderColor: colors.line,
    ...typography.body,
  },
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingTop: spacing.xs,
  },
  button: {
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  selected: { backgroundColor: colors.actionSurface, opacity: motion.pressedOpacity },
  label: { color: colors.ink, ...typography.body, fontWeight: '600' },
  error: { color: colors.action, ...typography.caption, padding: spacing.sm },
})
