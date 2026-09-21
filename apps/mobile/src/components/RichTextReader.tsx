import { Fragment } from 'react'
import { Linking, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'
import {
  spacing,
  studyCommitMistBlueColors as colors,
  typography,
} from '@studycommit/design-tokens'
import type { RichTextDocument, RichTextNode } from '@studycommit/rpc-contracts/rich-text'

/** 详情页使用原生只读渲染，避免 WebView 动态高度失败后正文被压成零高度。 */
export function RichTextReader({ document }: { document: RichTextDocument }) {
  return (
    <View accessibilityLabel="记录正文" style={styles.reader}>
      {(document.doc.content ?? []).map((node, index) => (
        <Block key={`${node.type}-${index}`} node={node} />
      ))}
    </View>
  )
}

function Block({ node, depth = 0 }: { node: RichTextNode; depth?: number }) {
  if (node.type === 'horizontalRule') {
    return <View style={styles.rule} />
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (
      <View style={styles.list}>
        {(node.content ?? []).map((item, index) => (
          <View key={`${item.type}-${index}`} style={styles.listRow}>
            <Text style={styles.listMarker}>
              {node.type === 'orderedList' ? `${index + 1}.` : '•'}
            </Text>
            <View style={styles.listContent}>
              {(item.content ?? []).map((child, childIndex) => (
                <Block key={`${child.type}-${childIndex}`} node={child} depth={depth + 1} />
              ))}
            </View>
          </View>
        ))}
      </View>
    )
  }
  if (node.type === 'blockquote') {
    return (
      <View style={styles.quote}>
        {(node.content ?? []).map((child, index) => (
          <Block key={`${child.type}-${index}`} node={child} depth={depth + 1} />
        ))}
      </View>
    )
  }
  if (node.type === 'codeBlock') {
    return <Text style={styles.codeBlock}>{inlineChildren(node)}</Text>
  }
  const headingLevel = Number(node.attrs?.level ?? 2)
  const blockStyle =
    node.type === 'heading'
      ? headingLevel === 1
        ? styles.headingOne
        : headingLevel === 2
          ? styles.headingTwo
          : styles.headingThree
      : styles.paragraph
  return (
    <Text style={[blockStyle, depth > 0 && styles.nestedParagraph]}>
      {(node.content ?? []).map((child, index) => (
        <Inline key={`${child.type}-${index}`} node={child} />
      ))}
    </Text>
  )
}

function Inline({ node }: { node: RichTextNode }) {
  if (node.type === 'hardBreak') {
    return '\n'
  }
  if (node.type !== 'text') {
    return (
      <Fragment>
        {(node.content ?? []).map((child, index) => (
          <Inline key={index} node={child} />
        ))}
      </Fragment>
    )
  }
  const marks = new Set((node.marks ?? []).map((mark) => mark.type))
  const linkValue = node.marks?.find((mark) => mark.type === 'link')?.attrs?.href
  const link = typeof linkValue === 'string' ? linkValue : null
  const style: StyleProp<TextStyle> = [
    marks.has('bold') && styles.bold,
    marks.has('italic') && styles.italic,
    marks.has('strike') && styles.strike,
    marks.has('underline') && styles.underline,
    marks.has('code') && styles.code,
    link && styles.link,
  ]
  if (link) {
    return (
      <Text accessibilityRole="link" onPress={() => void Linking.openURL(link)} style={style}>
        {node.text ?? ''}
      </Text>
    )
  }
  return <Text style={style}>{node.text ?? ''}</Text>
}

function inlineChildren(node: RichTextNode): string {
  if (node.type === 'text') {
    return node.text ?? ''
  }
  if (node.type === 'hardBreak') {
    return '\n'
  }
  return (node.content ?? []).map(inlineChildren).join('')
}

const styles = StyleSheet.create({
  reader: { gap: spacing.sm },
  paragraph: { ...typography.body, color: colors.ink },
  nestedParagraph: { marginBottom: 0 },
  headingOne: { ...typography.title, color: colors.ink, marginTop: spacing.sm },
  headingTwo: { ...typography.heading, color: colors.ink, marginTop: spacing.sm },
  headingThree: { ...typography.subheading, color: colors.ink, marginTop: spacing.xs },
  list: { gap: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  listMarker: { ...typography.body, color: colors.action, width: spacing.lg, textAlign: 'right' },
  listContent: { flex: 1 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.action, paddingLeft: spacing.md },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: spacing.sm,
  },
  codeBlock: {
    ...typography.bodySmall,
    color: colors.ink,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    fontFamily: 'monospace',
  },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  underline: { textDecorationLine: 'underline' },
  code: { fontFamily: 'monospace', backgroundColor: colors.surfaceSoft },
  link: { color: colors.action, textDecorationLine: 'underline' },
})
