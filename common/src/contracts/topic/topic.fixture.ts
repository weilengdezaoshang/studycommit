import type { Topic, TopicPage } from './topic.schema'

export const activeTopicFixture: Topic = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: '22222222-2222-4222-8222-222222222222',
  name: 'Electron 架构',
  description: '理解 Main、Preload 与 IPC',
  color: '#4F46E5',
  status: 'active',
  totalDurationSeconds: 0,
  version: 1,
  createdAt: '2026-08-17T07:00:00.000Z',
  updatedAt: '2026-08-17T07:00:00.000Z',
  deletedAt: null,
}

export const activeTopicPageFixture: TopicPage = {
  items: [activeTopicFixture],
  pageInfo: {
    hasNextPage: false,
    nextCursor: null,
  },
}
