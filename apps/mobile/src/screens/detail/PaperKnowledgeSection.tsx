import { useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  knowledgeHistoryLabel,
  knowledgeRelationLabel,
  PAPER_KNOWLEDGE_COPY,
  usePaperKnowledge,
  useRelationCandidates,
} from '@studycommit/common/paper-react'
import { spacing, typography } from '@studycommit/design-tokens'
import { useMobileServices } from '../../core/MobileServicesProvider'
import { paperColors } from '../../features/papers/paper-visual'

export function PaperKnowledgeSection({
  paperId,
  understanding,
}: {
  paperId: string
  understanding?: string | null
}) {
  const { papers, search } = useMobileServices()
  const navigation = useNavigation()
  const knowledge = usePaperKnowledge({
    paperId,
    papers,
    storage: AsyncStorage,
    createId: Crypto.randomUUID,
  })
  const [mode, setMode] = useState<'understanding' | 'application' | 'link' | null>(null)
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [relationId, setRelationId] = useState(() => Crypto.randomUUID())
  const [history, setHistory] = useState(false)
  const candidates = useRelationCandidates(search, query, paperId)
  const button = (label: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={action}
      style={styles.button}
    >
      <Text style={{ color: disabled ? paperColors.muted : paperColors.action }}>{label}</Text>
    </Pressable>
  )
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{PAPER_KNOWLEDGE_COPY.heading}</Text>
      <Text style={styles.body}>
        {knowledge.data.additions.at(-1)?.content || understanding || PAPER_KNOWLEDGE_COPY.empty}
      </Text>
      <View style={styles.row}>
        {button(PAPER_KNOWLEDGE_COPY.understand, () =>
          setMode(mode === 'understanding' ? null : 'understanding'),
        )}
        {button(PAPER_KNOWLEDGE_COPY.apply, () =>
          setMode(mode === 'application' ? null : 'application'),
        )}
      </View>
      {(mode === 'understanding' || mode === 'application') && (
        <View style={styles.section}>
          <TextInput
            accessibilityLabel={
              mode === 'understanding'
                ? PAPER_KNOWLEDGE_COPY.understand
                : PAPER_KNOWLEDGE_COPY.apply
            }
            multiline
            value={knowledge.drafts[mode]}
            editable={!knowledge.busy && knowledge.draftReady}
            onChangeText={(text) => knowledge.edit(mode, text)}
            placeholder={PAPER_KNOWLEDGE_COPY.placeholder}
            style={styles.input}
          />
          {button(
            knowledge.busy ? PAPER_KNOWLEDGE_COPY.saving : PAPER_KNOWLEDGE_COPY.save,
            () => void knowledge.append(mode),
            knowledge.busy || !knowledge.drafts[mode].trim(),
          )}
        </View>
      )}
      {mode === 'link' && (
        <View style={styles.section}>
          <TextInput
            accessibilityLabel="搜索关联记录"
            value={query}
            onChangeText={setQuery}
            maxLength={50}
            placeholder="搜索要关联的记录"
            style={styles.input}
          />
          {candidates.items.map((item) => (
            <View key={item.id}>
              {button(
                (target === item.id ? '已选择 · ' : '') + item.content.slice(0, 90),
                () => {
                  setTarget(item.id)
                  setRelationId(Crypto.randomUUID())
                },
                knowledge.data.relations.some((r) => r.targetId === item.id),
              )}
            </View>
          ))}
          {candidates.busy && <Text>正在搜索…</Text>}
          {candidates.error && <Text>{candidates.error}</Text>}
          {(candidates.more || candidates.error) &&
            button('加载候选', candidates.load, candidates.busy)}
          <TextInput
            accessibilityLabel="关联理由"
            value={reason}
            onChangeText={setReason}
            maxLength={2000}
            placeholder="为什么有关？（选填）"
            style={styles.input}
          />
          {button(
            '确认关联',
            () => {
              if (target) {
                void knowledge.link(target, reason, relationId).then((ok) => {
                  if (ok) {
                    setTarget(null)
                    setReason('')
                    setMode(null)
                  }
                })
              }
            },
            !target || knowledge.busy,
          )}
        </View>
      )}
      {knowledge.loading && <Text>正在读取理解与关联…</Text>}
      {knowledge.error && (
        <View>
          <Text accessibilityRole="alert">{knowledge.error}</Text>
          {button('重新读取', () => void knowledge.refresh())}
        </View>
      )}
      <View style={styles.divided}>
        {button(
          `◷  ${knowledgeHistoryLabel(knowledge.data.additions.length, knowledge.data.additionsHasMore)}  ${history ? '⌄' : '›'}`,
          () => setHistory(!history),
        )}
      </View>
      {history &&
        knowledge.data.additions.map((item) => (
          <View key={item.id} style={styles.section}>
            <Text style={styles.meta}>
              {item.kind === 'understanding' ? '补充理解' : '实际应用'} ·{' '}
              {new Date(item.createdAt).toLocaleString()}
            </Text>
            <Text selectable>{item.content}</Text>
          </View>
        ))}
      <View style={[styles.row, styles.divided]}>
        <Text style={styles.relationHeading}>
          {knowledgeRelationLabel(knowledge.data.relations.length, knowledge.data.relationsHasMore)}
        </Text>
        {button(`+ ${PAPER_KNOWLEDGE_COPY.link}`, () => setMode(mode === 'link' ? null : 'link'))}
      </View>
      {knowledge.data.relations.map((relation) => (
        <View key={relation.id} style={styles.relation}>
          {button(relation.content, () =>
            navigation.navigate('PaperDetail', { paperId: relation.targetId }),
          )}
          <Text>{relation.reason || '未填写关联理由'}</Text>
          {button('移除关联', () => void knowledge.unlink(relation), knowledge.busy)}
        </View>
      ))}
      {knowledge.undo &&
        button('关联已移除 · 撤销', () => void knowledge.restore(), knowledge.busy)}
    </View>
  )
}
const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  button: { minHeight: 44, justifyContent: 'center', paddingVertical: spacing.sm },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: paperColors.line,
    borderRadius: spacing.sm,
    padding: spacing.md,
    color: paperColors.ink,
    ...typography.body,
  },
  body: { ...typography.body, color: paperColors.ink },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    paddingTop: spacing.sm,
  },
  relationHeading: { ...typography.body, color: paperColors.ink },
  relation: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    borderRadius: spacing.sm,
    backgroundColor: paperColors.actionSurface,
    padding: spacing.md,
  },
  heading: {
    ...typography.subheading,
    color: paperColors.ink,
    alignSelf: 'flex-start',
    borderBottomWidth: 3,
    borderBottomColor: paperColors.actionSurfaceStrong,
  },
  meta: { ...typography.caption, color: paperColors.muted },
})
