/**
 * 纸页问题状态机(契约语义的一部分,与 papers schema 同步维护):
 * none ─设置问题─▶ thinking ─解决─▶ resolved,resolved ─重新打开─▶ thinking,
 * thinking/resolved ─移除问题─▶ none。
 * 服务端落库与客户端乐观更新共用同一套迁移规则,避免两端语义漂移。
 */

export type PaperQuestionStatus = 'none' | 'thinking' | 'resolved'

export type PaperQuestionCommand = {
  status: PaperQuestionStatus
  /** 建立/修改问题时提供;trim 后 1~2000 字。 */
  questionText?: string | null
}

/** questionResolvedAt 的三种落库动作:now 取服务端当前时间,clear 置空,keep 保持原值。 */
export type QuestionResolvedAtAction = 'now' | 'clear' | 'keep'

export type QuestionTransitionPlan = {
  questionStatus: PaperQuestionStatus
  questionText: string | null
  questionResolvedAt: QuestionResolvedAtAction
  /** 是否有实际字段变化;无变化时调用方应按幂等处理,不递增版本。 */
  changed: boolean
  /** 双写列:hasQuestion 与 isQuestionResolved 的目标值。 */
  hasQuestion: boolean
  isQuestionResolved: boolean
}

export type QuestionTransitionError =
  | { ok: false; reason: 'invalid_transition'; message: string }
  | { ok: false; reason: 'question_text_required'; message: string }

export type QuestionTransitionResult =
  { ok: true; plan: QuestionTransitionPlan } | QuestionTransitionError

export const QUESTION_TEXT_MAX_LENGTH = 2_000

export const QUESTION_ERROR_MESSAGE = {
  invalidTransition: '问题状态不能这样切换',
  questionTextRequired: '设置问题需要先写下问题内容',
} as const

/** 旧布尔字段推导三态;仅用于读取旧数据或测试,写路径必须走 planQuestionTransition。 */
export function questionStatusOfBooleans(
  hasQuestion: boolean,
  isQuestionResolved: boolean,
): PaperQuestionStatus {
  if (hasQuestion && isQuestionResolved) {
    return 'resolved'
  }
  if (hasQuestion) {
    return 'thinking'
  }
  return 'none'
}

function normalizeQuestionText(questionText: PaperQuestionCommand['questionText']): string | null {
  if (typeof questionText !== 'string') {
    return null
  }
  return questionText.trim()
}

/**
 * 计算问题状态迁移的目标字段。
 * - resolved 必有 questionText 与 questionResolvedAt;
 * - thinking 必清空解决时间,重开/继续思考时无新文本则保留原问题文本;
 * - none 清空问题文本;resolved 下更新文本保持首次解决时间。
 */
export function planQuestionTransition(input: {
  current: PaperQuestionStatus
  command: PaperQuestionCommand
  /** 当前文本,用于判断是否真的有变化,以及无新文本时沿用。 */
  currentQuestionText?: string | null
}): QuestionTransitionResult {
  const { current, command } = input
  const target = command.status
  const text = normalizeQuestionText(command.questionText)
  const currentText = input.currentQuestionText ?? null

  if (current === 'none' && target === 'resolved') {
    return {
      ok: false,
      reason: 'invalid_transition',
      message: QUESTION_ERROR_MESSAGE.invalidTransition,
    }
  }
  if (target === 'thinking' && current === 'none' && !text) {
    return {
      ok: false,
      reason: 'question_text_required',
      message: QUESTION_ERROR_MESSAGE.questionTextRequired,
    }
  }

  if (current === 'none' && target === 'none') {
    return { ok: true, plan: noChangePlan('none') }
  }

  // 目标为 thinking/resolved 时,未提供新文本则沿用当前文本(thinking/resolved 行必有文本)
  const nextText = text ?? currentText
  if (current === target && nextText === currentText) {
    return { ok: true, plan: noChangePlan(target, currentText) }
  }

  switch (target) {
    case 'thinking':
      return {
        ok: true,
        plan: {
          questionStatus: 'thinking',
          questionText: nextText,
          questionResolvedAt: 'clear',
          changed: true,
          hasQuestion: true,
          isQuestionResolved: false,
        },
      }
    case 'resolved':
      return {
        ok: true,
        plan: {
          questionStatus: 'resolved',
          questionText: nextText,
          // 保持首次解决时间:只有从非 resolved 进入 resolved 才取当前时间
          questionResolvedAt: current === 'resolved' ? 'keep' : 'now',
          changed: true,
          hasQuestion: true,
          isQuestionResolved: true,
        },
      }
    case 'none':
      return {
        ok: true,
        plan: {
          questionStatus: 'none',
          questionText: null,
          questionResolvedAt: 'clear',
          changed: true,
          hasQuestion: false,
          isQuestionResolved: false,
        },
      }
  }
}

function noChangePlan(
  status: PaperQuestionStatus,
  questionText: string | null = null,
): QuestionTransitionPlan {
  return {
    questionStatus: status,
    questionText: status === 'none' ? null : questionText,
    questionResolvedAt: status === 'resolved' ? 'keep' : 'clear',
    changed: false,
    hasQuestion: status !== 'none',
    isQuestionResolved: status === 'resolved',
  }
}
