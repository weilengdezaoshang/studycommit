export const aiIpcChannels = {
  confirmPaperExplain: 'ai:paper-explain-confirm',
  /** 计费通道:报价/受理/查询(免费同步生成入口已移除)。 */
  quote: 'ai:quote',
  startRun: 'ai:start-run',
  getRun: 'ai:get-run',
} as const
