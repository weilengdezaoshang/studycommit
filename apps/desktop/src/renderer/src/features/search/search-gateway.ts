import type { Paper, Topic } from '@studycommit/rpc-contracts'
import { unwrapIpcResult } from '../study-session/api/desktop-study-session-gateway'

/** 统一搜索网关(BE-310):命中纸页与箱子,离线时由调用方回退本地。 */
export interface SearchGateway {
  query(input: { q: string; limit?: number }): Promise<{
    papers: { items: Paper[]; pageInfo: { hasNextPage: boolean; nextCursor: string | null } }
    topics: Array<Pick<Topic, 'id' | 'name'> & { paperCount: number }>
  }>
}

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

export function createDesktopSearchGateway(
  api: Window['studyCommit']['search'] = window.studyCommit.search,
): SearchGateway {
  return {
    async query(input) {
      return unwrapIpcResult(await api.query(input))
    },
  }
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
