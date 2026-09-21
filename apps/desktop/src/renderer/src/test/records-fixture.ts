import { vi } from 'vitest'
import { buildSeedPapers, DESKTOP_TOPICS } from '../features/papers/mock-data'

/** 导航用例显式提供成功的远端数据；不再依赖断网时冒充缓存的种子记录。 */
export function mockRemoteRecords() {
  const papers = buildSeedPapers().map((paper) => ({ ...paper, contentDocument: null }))
  window.studyCommit.papers.list = vi.fn().mockResolvedValue({
    ok: true,
    data: { items: papers, pageInfo: { hasNextPage: false, nextCursor: null } },
  })
  window.studyCommit.papers.get = vi.fn(async (id) => ({
    ok: true as const,
    data: papers.find((paper) => paper.id === id)!,
  }))
  window.studyCommit.topics.listActive = vi.fn().mockResolvedValue({
    ok: true,
    data: { items: DESKTOP_TOPICS, pageInfo: { hasNextPage: false, nextCursor: null } },
  })
  window.studyCommit.papers.organize = vi.fn().mockImplementation(async (input) => ({
    ok: true,
    data: {
      ...papers.find((paper) => paper.id === input.paperId),
      topicId: input.topicId,
      status: 'organized',
      version: 2,
    },
  }))
}
