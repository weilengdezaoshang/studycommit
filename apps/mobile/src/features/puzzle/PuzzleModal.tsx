import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { puzzleHtml } from '@studycommit/puzzle-ui/mobile-bundle'
import type { ScratchPoint } from '@studycommit/common/puzzle-runtime'
import { createOfflinePuzzleApi } from '@studycommit/common/puzzle-runtime'
import {
  spacing,
  studyCommitMistBlueColors as colors,
  typography,
} from '@studycommit/design-tokens'
import { getAuthGate } from '../../infrastructure/auth/session-store'
import { usePapersState, papersActions } from '../papers/papers-store'
import { paperTypography } from '../../theme/paper-typography'
import { useMobileServices } from '../../core/MobileServicesProvider'

function createPuzzleId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function PuzzleModal({
  account,
  onClose,
}: {
  account: string
  onClose: () => void
}) {
  const data = usePapersState(),
    services = useMobileServices(),
    insets = useSafeAreaInsets(),
    web = useRef<WebView<object>>(null)
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false)
  const cloud = useMemo(
    () =>
      services.puzzles
        ? createOfflinePuzzleApi({
            account,
            remote: services.puzzles,
            storage: { get: AsyncStorage.getItem, set: AsyncStorage.setItem },
            createId: createPuzzleId,
          })
        : null,
    [account, services.puzzles],
  )
  const strokeKey = (rewardId: string) => `studycommit.puzzle.strokes.v1.${account}.${rewardId}`
  const send = (value: unknown) =>
    web.current?.injectJavaScript(`window.__puzzleReceive?.(${JSON.stringify(value)});true;`)
  useEffect(() => {
    if (ready) {
      send({ type: 'init', papers: data.papers, topics: data.topics })
    }
  }, [ready, data.papers, data.topics])
  useEffect(() => {
    let alive = true
    const setReduced = (enabled: boolean) => {
      if (alive && ready) {
        web.current?.injectJavaScript(
          `document.documentElement.classList.toggle('reduce-motion',${enabled});window.dispatchEvent(new Event('puzzle-reduced-motion'));true;`,
        )
      }
    }
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      alive = false
      subscription.remove()
    }
  }, [ready])
  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {failed ? (
          <View style={styles.fallback}>
            <Text>画册暂时未能打开，已保存的碎片不会丢失。</Text>
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text style={styles.label}>返回记录本</Text>
            </Pressable>
          </View>
        ) : (
          <WebView<object>
            ref={web}
            source={{ html: puzzleHtml, baseUrl: 'about:blank' }}
            originWhitelist={['about:blank']}
            javaScriptEnabled
            scrollEnabled
            bounces={false}
            setSupportMultipleWindows={false}
            allowFileAccess={false}
            mixedContentMode="never"
            onShouldStartLoadWithRequest={(r) => r.url === 'about:blank'}
            onError={() => setFailed(true)}
            onContentProcessDidTerminate={() => setFailed(true)}
            onMessage={async (event) => {
              let m: { type?: string; id?: number; method?: string; args?: unknown[] }
              try {
                m = JSON.parse(event.nativeEvent.data)
              } catch {
                return
              }
              if (!m || typeof m !== 'object') {
                return
              }
              if (m.type === 'ready') {
                setReady(true)
                return
              }
              if (m.type === 'close') {
                onClose()
                return
              }
              if (m.type !== 'request' || !Number.isSafeInteger(m.id)) {
                return
              }
              try {
                if (getAuthGate().session?.user.id !== account) {
                  throw new Error('登录状态已变化，请重新打开画册。')
                }
                let value: unknown = null
                if (!cloud) {
                  throw new Error('拼图服务暂时不可用')
                }
                if (m.method === 'album') {
                  value = await cloud.album()
                } else if (m.method === 'selectArtwork') {
                  const artworkId = m.args?.[0]
                  if (typeof artworkId !== 'string') {
throw new Error('画作已失效')
}
                  value = await cloud.selectArtwork(artworkId)
                } else if (m.method === 'reveal') {
                  const rewardId = m.args?.[0]
                  if (typeof rewardId !== 'string') {
throw new Error('碎片已失效')
}
                  value = await cloud.reveal(rewardId)
                } else if (m.method === 'featureArtwork') {
                  const artworkId = m.args?.[0]
                  if (typeof artworkId !== 'string') {
throw new Error('画作已失效')
}
                  value = await cloud.featureArtwork(artworkId)
                } else if (m.method === 'loadStrokes') {
                  const rewardId = m.args?.[0]
                  if (typeof rewardId !== 'string') {
throw new Error('碎片已失效')
}
                  const raw = await AsyncStorage.getItem(strokeKey(rewardId))
                  value = raw ? validateStrokes(JSON.parse(raw)) : []
                } else if (m.method === 'saveStrokes') {
                  const [rewardId, rawStrokes] = m.args ?? []
                  if (typeof rewardId !== 'string') {
throw new Error('碎片已失效')
}
                  await AsyncStorage.setItem(
                    strokeKey(rewardId),
                    JSON.stringify(validateStrokes(rawStrokes)),
                  )
                } else if (m.method === 'organize') {
                  const [id, topic] = m.args ?? []
                  if (
                    typeof id !== 'string' ||
                    typeof topic !== 'string' ||
                    !data.papers.some((p) => p.id === id) ||
                    !data.topics.some((t) => t.id === topic)
                  ) {
                    throw new Error('记录或主题已失效')
                  }
                  const saved = await papersActions.organizePaper(id, topic)
                  if (!saved) {
                    throw new Error('整理未保存，请重试。')
                  }
                } else {
                  throw new Error('不支持的画册操作')
                }
                send({ type: 'reply', id: m.id, value })
              } catch (e) {
                send({
                  type: 'reply',
                  id: m.id,
                  error: e instanceof Error ? e.message : '保存失败，请重试',
                })
              }
            }}
          />
        )}
      </View>
    </Modal>
  )
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  entry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  label: {
    ...paperTypography.drawer,
    color: colors.action,
    fontSize: typography.bodySmall.fontSize,
  },
  fallback: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
})

function validateStrokes(value: unknown): ScratchPoint[] {
  if (!Array.isArray(value)) {
return []
}
  return value.filter(
    (point): point is ScratchPoint =>
      typeof point === 'object' &&
      point !== null &&
      typeof (point as ScratchPoint).x === 'number' &&
      typeof (point as ScratchPoint).y === 'number',
  )
}
