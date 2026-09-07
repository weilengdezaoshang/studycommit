import { unwrapIpcResult } from '../study-session/api/desktop-study-session-gateway'

/** 月度装订网关(BE-311):时区必填,服务端按用户时区聚合。 */
export interface ReviewGateway {
  monthly(input: { month: string; timezone: string }): Promise<{
    month: string
    timezone: string
    paperCount: number
    topicCount: number
    resolvedCount: number
    days: { date: string; count: number }[]
  }>
}

export function createDesktopReviewGateway(
  api: Window['studyCommit']['reviews'] = window.studyCommit.reviews,
): ReviewGateway {
  return {
    async monthly(input) {
      return unwrapIpcResult(await api.monthly(input))
    },
  }
}
