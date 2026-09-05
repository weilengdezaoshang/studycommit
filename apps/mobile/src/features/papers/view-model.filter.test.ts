import { buildHomeViewModel, INBOX_TOPIC_ID, parseDateKey } from './view-model'
import { getPapersState, resetPapersStore } from './papers-store'

function toDateKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

describe('buildHomeViewModel topic filter', () => {
  beforeEach(() => {
    resetPapersStore()
  })

  it('以待整理筛选时当天时间流只显示未归类纸页', () => {
    const state = getPapersState()
    const inboxPaper = state.papers.find((paper) => paper.status === 'inbox' && !paper.deletedAt)
    expect(inboxPaper).toBeDefined()
    const dateKey = inboxPaper!.createdAt.slice(0, 10)

    const all = buildHomeViewModel(state, dateKey, parseDateKey(dateKey), null)
    const filtered = buildHomeViewModel(state, dateKey, parseDateKey(dateKey), INBOX_TOPIC_ID)

    expect(all.papersOfDate.length).toBeGreaterThan(0)
    expect(filtered.papersOfDate.length).toBeGreaterThan(0)
    expect(filtered.papersOfDate.every((row) => row.paper.status === 'inbox')).toBe(true)
    expect(filtered.papersOfDate.length).toBeLessThanOrEqual(all.papersOfDate.length)
  })

  it('按箱子筛选时当天时间流只显示该箱子的纸页', () => {
    const state = getPapersState()
    const organizedPaper = state.papers.find(
      (paper) => paper.status === 'organized' && paper.topicId && !paper.deletedAt,
    )
    expect(organizedPaper).toBeDefined()
    const dateKey = organizedPaper!.createdAt.slice(0, 10)
    const topicId = organizedPaper!.topicId!

    const filtered = buildHomeViewModel(state, dateKey, parseDateKey(dateKey), topicId)

    expect(filtered.papersOfDate.length).toBeGreaterThan(0)
    expect(filtered.papersOfDate.every((row) => row.paper.topicId === topicId)).toBe(true)
  })

  it('未选择箱子时当天时间流显示全部纸页', () => {
    const state = getPapersState()
    const dateKey = toDateKeyFromDate(new Date())

    const all = buildHomeViewModel(state, dateKey, parseDateKey(dateKey), null)

    expect(all.papersOfDate).toHaveLength(
      state.papers.filter((paper) => paper.createdAt.slice(0, 10) === dateKey).length,
    )
  })
})
