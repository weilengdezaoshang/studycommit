import { useEffect, useReducer, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import {
  canStartStudy,
  createIdempotencyKey,
  initialStartStudyState,
  startStudyReducer,
  toUiError,
  type UiError,
} from '@studycommit/common/study-session-runtime'
import { Button } from '../../../components/Button'
import { Dropdown } from '../../../components/Dropdown'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { LoadingState } from '../../../components/LoadingState'
import { TextField } from '../../../components/TextField'
import { useMobileServices } from '../../../core/MobileServicesProvider'
import { useAppTheme } from '../../../theme/ThemeProvider'
import type { StudySessionController } from '@studycommit/common/study-session-react'

const GOAL_MAX = 500

export function StartStudyPanel({
  onCancel,
  onGoToTopics,
  study,
}: {
  onCancel: () => void
  onGoToTopics: () => void
  study: Pick<StudySessionController, 'create'>
}) {
  const theme = useAppTheme()
  const { topics } = useMobileServices()
  const [state, dispatch] = useReducer(startStudyReducer, initialStartStudyState)
  const [topicId, setTopicId] = useState('')
  const [goal, setGoal] = useState('')
  const pendingKey = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'topics-started' })
    void topics.listActive().then(
      (page) => {
        if (!cancelled) {
          dispatch({ type: 'topics-succeeded', topics: page.items })
        }
      },
      (error) => {
        if (!cancelled) {
          dispatch({ type: 'topics-failed', error: toUiError(error) })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [topics])

  async function submit() {
    if (state.status === 'submitting' || !canStartStudy(topicId, goal)) {
      return
    }
    const idempotencyKey =
      (state.status === 'error' && state.idempotencyKey) ||
      pendingKey.current ||
      createIdempotencyKey()
    pendingKey.current = idempotencyKey
    dispatch({ type: 'submit-started', idempotencyKey })
    try {
      const selected = 'topics' in state ? state.topics.find((topic) => topic.id === topicId) : null
      await study.create({
        topicId,
        goal: goal.trim() || null,
        idempotencyKey,
        topicName: selected?.name,
      })
      pendingKey.current = null
    } catch (error) {
      dispatch({ type: 'submit-failed', error: error as UiError })
    }
  }

  if (state.status === 'loading-topics') {
    return <LoadingState label="正在加载可学习专题" />
  }

  if (state.status === 'empty-topics') {
    return (
      <EmptyState
        actionLabel="前往专题"
        description="开始学习前需要至少一个未归档专题。"
        icon="book-outline"
        onAction={onGoToTopics}
        title="还没有可学习的专题"
      />
    )
  }

  const submitting = state.status === 'submitting'
  const formError = state.status === 'error' ? state.error : null
  const topicOptions = 'topics' in state ? state.topics : []
  const readyToStart = canStartStudy(topicId, goal)

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          overflow: 'visible',
          padding: theme.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        style={{ overflow: 'visible' }}
      >
        <Dropdown
          disabled={submitting}
          hint={topicId ? undefined : '请选择一个专题后再开始。'}
          label="专题"
          onChange={setTopicId}
          options={topicOptions.map((topic) => ({ label: topic.name, value: topic.id }))}
          placeholder="请选择专题"
          value={topicId}
        />
        <TextField
          editable={!submitting}
          helperText={goal.trim() ? `${goal.length}/${GOAL_MAX}` : '请填写学习目标后再开始。'}
          label="学习目标"
          maxLength={GOAL_MAX}
          multiline
          onChangeText={setGoal}
          placeholder="请填写学习目标，最多 500 字"
          value={goal}
        />
        {formError ? (
          <ErrorState
            description={
              formError.requestId
                ? `${formError.message}（${formError.requestId}）`
                : formError.message
            }
            title="无法开始学习"
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button disabled={submitting} onPress={onCancel} variant="secondary">
              取消
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button disabled={!readyToStart} loading={submitting} onPress={() => void submit()}>
              {submitting ? '正在开始' : '开始学习'}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
