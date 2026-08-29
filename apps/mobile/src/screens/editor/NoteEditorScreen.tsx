import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { paperColors } from '../../features/papers/paper-visual'
import { papersActions } from '../../features/papers/papers-store'

/** 编辑器:只支持文本与图片;标题、主题与学习目标均非必填。 */
export function NoteEditorScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [content, setContent] = useState('')
  const [isQuestionActive, setQuestionActive] = useState(false)
  const [photoAttached, setPhotoAttached] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = () => {
    if (!content.trim()) {
      setSaveError('先写点什么再记下')
      return
    }
    papersActions.createPaper({ content: content.trim(), hasQuestion: isQuestionActive })
    navigation.goBack()
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.topButton}
        >
          <Text style={styles.cancelText}>取消</Text>
        </Pressable>
        <Text style={styles.title}>新记录</Text>
        <Pressable accessibilityRole="button" onPress={save} style={styles.topButton}>
          <Text style={styles.saveText}>记下</Text>
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{formatToday()}</Text>
          <Text style={styles.dateText}>STUDYCOMMIT</Text>
        </View>
        <TextInput
          style={styles.input}
          multiline
          autoFocus
          placeholder="写点什么吧……"
          placeholderTextColor={paperColors.mutedFaint}
          value={content}
          onChangeText={(value) => {
            setContent(value)
            setSaveError(null)
          }}
          textAlignVertical="top"
        />
        {photoAttached && <View style={styles.photoPlaceholder} />}
      </View>

      <View style={[styles.tools, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoAttached ? '重新选择图片' : '添加图片'}
          onPress={() => setPhotoAttached((value) => !value)}
          style={[styles.tool, photoAttached && styles.toolActive]}
        >
          <Ionicons name="image-outline" size={16} color={paperColors.muted} />
          <Text style={styles.toolText}>图片</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isQuestionActive ? '取消问题标记' : '标记为问题'}
          onPress={() => setQuestionActive((value) => !value)}
          style={[styles.tool, isQuestionActive && styles.toolActive]}
        >
          <Ionicons name="help-circle-outline" size={16} color={paperColors.muted} />
          <Text style={styles.toolText}>标记问题</Text>
        </Pressable>
        <Text style={styles.hint}>{saveError ?? '草稿已自动保存'}</Text>
      </View>
    </KeyboardAvoidingView>
  )
}

function formatToday(): string {
  const date = new Date()
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ]
  return `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.canvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  topButton: { minWidth: 56, height: 40, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: paperColors.muted, fontSize: 14 },
  title: { color: paperColors.muted, fontSize: 14, fontWeight: '500' },
  saveText: {
    color: paperColors.paper,
    backgroundColor: paperColors.action,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sheet: {
    flex: 1,
    margin: 12,
    marginBottom: 16,
    backgroundColor: paperColors.paper,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: paperColors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
    paddingBottom: 10,
  },
  dateText: { color: paperColors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  input: { flex: 1, color: paperColors.ink, fontSize: 15, lineHeight: 24, padding: 0 },
  photoPlaceholder: {
    height: 110,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: paperColors.actionSurface,
  },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  toolActive: { borderColor: paperColors.line, backgroundColor: paperColors.actionSurface },
  toolText: { color: paperColors.muted, fontSize: 12 },
  hint: { marginLeft: 'auto', color: paperColors.mutedFaint, fontSize: 11 },
})
