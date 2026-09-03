/** Prompt 版本:调整系统提示词时必须更新,并写入 agent_run 以便追溯。 */
export const AI_PROMPT_VERSION = 'companion-followup@1'

export const AI_ERROR = {
  unavailable: { code: 'AI_UNAVAILABLE', message: 'AI 服务暂不可用，可稍后再试' },
  outputInvalid: { code: 'AI_OUTPUT_INVALID', message: 'AI 输出不符合约定' },
} as const

export const AGENT_RUN_KIND = {
  companionFollowup: 'companion_followup',
} as const

export const AGENT_RUN_STATUS = {
  pending: 'pending',
  completed: 'completed',
  failed: 'failed',
} as const
