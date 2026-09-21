import { lazy, Suspense, useState } from 'react'
import { AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { usePuzzleOverview } from '@studycommit/common/puzzle-react'
import { createOfflinePuzzleApi, type PuzzleSyncState } from '@studycommit/common/puzzle-runtime'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useMemo } from 'react'
import {
  spacing,
  radii,
  studyCommitMistBlueColors as colors,
  typography,
} from '@studycommit/design-tokens'
import { useAuthSession } from '../../infrastructure/auth/session-store'
import { usePapersState } from '../papers/papers-store'
import { paperTypography } from '../../theme/paper-typography'
import { useMobileServices } from '../../core/MobileServicesProvider'

function createPuzzleId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const PuzzleModal = lazy(() => import('./PuzzleModal'))
export function PuzzleEntry() {
  const [open, setOpen] = useState(false)
  const [syncState, setSyncState] = useState<PuzzleSyncState>('synced')
  const session = useAuthSession()
  const data = usePapersState()
  const services = useMobileServices()
  const offline = useMemo(
    () =>
      session && services.puzzles
        ? createOfflinePuzzleApi({
            account: session.user.id,
            remote: services.puzzles,
            storage: { get: AsyncStorage.getItem, set: AsyncStorage.setItem },
            createId: createPuzzleId,
            onState: setSyncState,
          })
        : null,
    [session, services.puzzles],
  )
  const summary = usePuzzleOverview(offline?.album ?? null, Boolean(offline))
  const reloadAlbum = summary.reload
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void reloadAlbum()
      }
    })
    return () => subscription.remove()
  }, [reloadAlbum])
  if (!session || data.source !== 'server') {
    return null
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="打开拼图画册"
        onPress={() => {
          if (syncState === 'failed') {
            void summary.reload()
          }
          setOpen(true)
        }}
        style={({ pressed }) => [
          styles.entry,
          summary.overview?.pendingRewardId && styles.reward,
          pressed && styles.pressed,
        ]}
      >
        {summary.overview?.artwork?.assetUrl ? (
          <Image source={{ uri: summary.overview.artwork.assetUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholder} />
        )}
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {summary.overview?.artwork?.title ?? '我的画册'}
          </Text>
          <Text numberOfLines={1} style={styles.label}>
            {summary.loading
              ? '正在翻开…'
              : summary.error
                ? '点击重试'
                : syncState === 'pending'
                  ? '已离线保存 · 等待同步'
                  : syncState === 'failed'
                    ? '同步失败 · 点击重试'
                    : `${summary.overview?.progressText ?? '开始收集'} · ${summary.overview?.actionText ?? '选择画作'}`}
          </Text>
        </View>
        {summary.overview?.pendingRewardId && <Text style={styles.badge}>待擦开</Text>}
      </Pressable>
      {open && (
        <Suspense fallback={<Text>正在翻开画册…</Text>}>
          <PuzzleModal
            key={session.user.id}
            account={session.user.id}
            onClose={() => {
              setOpen(false)
              void summary.reload()
            }}
          />
        </Suspense>
      )}
    </>
  )
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  entry: {
    minHeight: 54,
    maxWidth: 250,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.paper,
  },
  reward: { borderColor: colors.accent, backgroundColor: '#fff8ef' },
  pressed: { opacity: 0.72 },
  image: { width: 46, height: 42, borderRadius: radii.sm },
  placeholder: { width: 46, height: 42, borderRadius: radii.sm, backgroundColor: colors.canvas },
  copy: { flex: 1, minWidth: 0 },
  title: { ...paperTypography.drawer, color: colors.ink, fontSize: typography.bodySmall.fontSize },
  label: {
    ...paperTypography.drawer,
    color: colors.action,
    fontSize: typography.bodySmall.fontSize,
  },
  badge: { color: '#b7614f', fontSize: 10, fontWeight: '700' },
  fallback: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
})
