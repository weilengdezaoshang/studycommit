/** 箱子名称的最大长度,与服务端契约保持一致。 */
export const TOPIC_NAME_MAX_LENGTH = 18

export const TOPIC_NAME_ERROR_MESSAGE = '箱子名称需为 1-18 个字符'

/**
 * 校验并归一化箱子名称;非法时返回 null。
 */
export function normalizeTopicName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > TOPIC_NAME_MAX_LENGTH) {
    return null
  }
  return trimmed
}
