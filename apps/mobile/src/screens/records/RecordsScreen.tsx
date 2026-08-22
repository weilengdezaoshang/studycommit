import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { LearningLogPage } from '@studycommit/common/contracts'
import { useToast } from '@studycommit/common/toast-react'
import { useMobileServices } from '../../core/MobileServicesProvider'
import { AppText } from '../../components/AppText'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { Screen } from '../../components/Screen'
import { useAppTheme } from '../../theme/ThemeProvider'

export function RecordsScreen() {
  const theme = useAppTheme()
  const toast = useToast()
  const { learningLogs } = useMobileServices()
  const [page, setPage] = useState<LearningLogPage | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPage(await learningLogs.list({ page: 1, pageSize: 20 }))
    } catch (nextError) {
      const nextErrorValue = nextError instanceof Error ? nextError : new Error('加载学习记录失败')
      setError(nextErrorValue)
      toast.show({ message: nextErrorValue.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [learningLogs, toast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <AppText variant="heading" weight="semibold">
            学习记录
          </AppText>
          <AppText color="muted">回顾每次学习留下的收获与下一步。</AppText>
        </View>
        {loading ? <LoadingState label="正在加载学习记录" /> : null}
        {!loading && error ? (
          <ErrorState
            description="暂时无法加载学习记录，请稍后重试。"
            onRetry={() => void load()}
            retrying={loading}
            title="学习记录加载失败"
          />
        ) : null}
        {!loading && !error && page?.items.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.colors.surfaceMuted }]}>
            <AppText weight="semibold">还没有学习记录</AppText>
            <AppText color="muted">完成一次学习后，收获会显示在这里。</AppText>
          </View>
        ) : null}
        {!loading && !error
          ? page?.items.map(({ learningLog, session, topic }) => (
              <View
                key={learningLog.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <AppText weight="semibold">{topic.name}</AppText>
                  <AppText color="muted" variant="caption">
                    {formatDate(session.completedAt)}
                  </AppText>
                </View>
                {session.goal ? <AppText color="muted">目标：{session.goal}</AppText> : null}
                <AppText variant="title" weight="semibold">
                  {formatDuration(learningLog.effectiveDurationSeconds)}
                </AppText>
                <RecordField label="学习收获" value={learningLog.gains} />
                <RecordField label="未解决问题" value={learningLog.problems} />
                <RecordField label="下一步" value={learningLog.nextStep} />
              </View>
            ))
          : null}
      </ScrollView>
    </Screen>
  )
}

function RecordField({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.field}>
      <AppText variant="label" weight="medium">
        {label}
      </AppText>
      <AppText color={value ? 'default' : 'muted'}>{value ?? '未填写'}</AppText>
    </View>
  )
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
    : '未完成'
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`
}

const styles = StyleSheet.create({
  content: { gap: 16, padding: 24 },
  heading: { gap: 6, marginBottom: 8 },
  empty: { alignItems: 'center', borderRadius: 12, gap: 8, padding: 24 },
  card: { borderWidth: 1, gap: 12, padding: 16 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  field: { gap: 4 },
})
