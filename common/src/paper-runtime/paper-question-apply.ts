import type { Paper } from '../contracts/paper/paper.schema'
import type {
  PaperQuestionCommand,
  PaperQuestionStatus,
} from '@studycommit/rpc-contracts/paper-question'
import { planQuestionTransition } from '@studycommit/rpc-contracts/paper-question'

/** 纸页问题侧车字段:从 paper 派生,extras 只保留 photoPath 等本地专属数据。 */
export type PaperQuestionExtras = {
  hasQuestion: boolean
  isQuestionResolved: boolean
  questionStatus: PaperQuestionStatus
}

export function questionExtrasOf(paper: Paper): PaperQuestionExtras {
  return {
    hasQuestion: paper.hasQuestion,
    isQuestionResolved: paper.isQuestionResolved,
    questionStatus: paper.questionStatus,
  }
}

/** 创建纸页时的问题初始字段:有问题文本用文本,否则标记疑问时以正文截断充当问题文本。 */
export function questionFieldsForCreate(input: {
  content: string
  hasQuestion?: boolean
  questionText?: string | null
}): { questionStatus: PaperQuestionStatus; questionText: string | null } {
  if (input.questionText) {
    return { questionStatus: 'thinking', questionText: input.questionText }
  }
  if (input.hasQuestion) {
    return { questionStatus: 'thinking', questionText: input.content.slice(0, 2_000) }
  }
  return { questionStatus: 'none', questionText: null }
}

/**
 * 乐观应用问题命令(纯函数):非法迁移或无变化时原样返回,否则按状态机推导新纸页,
 * 版本 +1 供乐观锁使用;失败回滚由调用方负责恢复输入引用。
 */
export function applyQuestionCommand(
  paper: Paper,
  command: PaperQuestionCommand,
  nowIso: string,
): Paper {
  const result = planQuestionTransition({
    current: paper.questionStatus,
    command,
    currentQuestionText: paper.questionText,
  })
  if (!result.ok || !result.plan.changed) {
    return paper
  }
  const { plan } = result
  return {
    ...paper,
    questionStatus: plan.questionStatus,
    questionText: plan.questionText,
    understandingText: paper.understandingText,
    questionResolvedAt:
      plan.questionResolvedAt === 'now'
        ? nowIso
        : plan.questionResolvedAt === 'clear'
          ? null
          : paper.questionResolvedAt,
    hasQuestion: plan.hasQuestion,
    isQuestionResolved: plan.isQuestionResolved,
    version: paper.version + 1,
    updatedAt: nowIso,
  }
}

/** AI 解释卡确认成功后本地落定“已解决”:服务端已写入,这里只同步视图,不再发起状态请求。 */
export function applyQuestionConfirmed(paper: Paper, nowIso: string): Paper {
  if (paper.questionStatus !== 'thinking') {
    return paper
  }
  return {
    ...paper,
    questionStatus: 'resolved',
    questionResolvedAt: nowIso,
    hasQuestion: true,
    isQuestionResolved: true,
    version: paper.version + 1,
    updatedAt: nowIso,
  }
}
