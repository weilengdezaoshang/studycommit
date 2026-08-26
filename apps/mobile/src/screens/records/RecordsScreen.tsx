import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
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
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const summary = useMemo(() => {
    const items = page?.items ?? []
    return {
      count: items.length,
      minutes: Math.round(
        items.reduce((total, item) => total + item.learningLog.effectiveDurationSeconds, 0) / 60,
      ),
      gains: items.filter((item) => item.learningLog.gains?.trim()).length,
    }
  }, [page])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={refreshing}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={styles.heading}>
          <AppText variant="heading" weight="semibold">
            学习记录
          </AppText>
          <AppText color="muted">回顾每次学习留下的收获与下一步。</AppText>
        </View>
        {!loading && !error && page?.items.length ? (
          <View style={[styles.summary, { backgroundColor: theme.colors.surfaceMuted }]}>
            <SummaryItem label="学习次数" value={`${summary.count} 次`} />
            <View style={[styles.summaryDivider, { backgroundColor: theme.colors.border }]} />
            <SummaryItem label="累计时长" value={formatMinutes(summary.minutes)} />
            <View style={[styles.summaryDivider, { backgroundColor: theme.colors.border }]} />
            <SummaryItem label="有收获" value={`${summary.gains} 次`} />
          </View>
        ) : null}
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
          ? page?.items.map(({ learningLog, session, topic }) => {
              const expanded = expandedId === learningLog.id
              return (
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${topic.name}，${expanded ? '收起' : '展开'}学习详情`}
                    onPress={() => setExpandedId(expanded ? null : learningLog.id)}
                    style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
                  >
                    <View style={styles.titleBlock}>
                      <AppText weight="semibold">{topic.name}</AppText>
                      <AppText color="muted" variant="caption">
                        {formatDate(session.completedAt)}
                      </AppText>
                    </View>
                    <AppText color="muted" variant="caption">
                      {expanded ? '收起详情' : '查看详情'}
                    </AppText>
                  </Pressable>
                  {session.goal ? <AppText color="muted">目标：{session.goal}</AppText> : null}
                  <View style={styles.durationRow}>
                    <AppText color="muted" variant="caption">
                      本次学习
                    </AppText>
                    <AppText variant="title" weight="semibold">
                      {formatDuration(learningLog.effectiveDurationSeconds)}
                    </AppText>
                  </View>
                  {expanded ? (
                    <View style={[styles.details, { borderTopColor: theme.colors.border }]}>
                      <RecordField label="学习收获" value={learningLog.gains} />
                      <RecordField label="未解决问题" value={learningLog.problems} />
                      <RecordField label="下一步" value={learningLog.nextStep} />
                    </View>
                  ) : null}
                </View>
              )
            })
          : null}
      </ScrollView>
    </Screen>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <AppText color="muted" variant="caption">
        {label}
      </AppText>
      <AppText weight="semibold">{value}</AppText>
    </View>
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

function formatMinutes(minutes: number) {
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}小时${minutes % 60 ? ` ${minutes % 60}分` : ''}`
    : `${minutes}分钟`
}

const styles = StyleSheet.create({
  content: { gap: 16, padding: 24, paddingBottom: 40 },
  heading: { gap: 6, marginBottom: 8 },
  empty: { alignItems: 'center', borderRadius: 12, gap: 8, padding: 24 },
  card: { borderWidth: 1, gap: 12, padding: 16 },
  summary: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
  },
  summaryItem: { alignItems: 'center', gap: 4, minWidth: 72 },
  summaryDivider: { height: 28, width: 1 },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  titleBlock: { flex: 1, gap: 4 },
  pressed: { opacity: 0.65 },
  durationRow: { alignItems: 'flex-start', gap: 2 },
  details: { borderTopWidth: 1, gap: 12, paddingTop: 12 },
  field: { gap: 4 },
})
