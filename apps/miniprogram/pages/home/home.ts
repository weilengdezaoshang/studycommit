import { MONITOR_EVENTS } from '../../constants/events'
import { ROUTES } from '../../constants/routes'
import { monitor } from '../../services/monitor-adapter'
import { getMockPapersApi, MOCK_TOPIC_ID, type MockTopic } from '../../services/mock-papers'
import type { Paper } from '@studycommit/rpc-contracts/papers'

type PaperViewModel = Paper & {
  dateKey: string
  dateLabel: string
  timeLabel: string
  topicLabel: string
  isInbox: boolean
}

type TopicViewModel = MockTopic & {
  paperCount: number
  isSelected: boolean
}

type WeekDayViewModel = {
  dateKey: string
  dayLabel: string
  weekdayLabel: string
  paperCount: number
  stack: number[]
  hasMore: boolean
  isSelected: boolean
}

type MonthDayViewModel = {
  dateKey: string
  dayLabel: string
  paperCount: number
  level: number
  isSelected: boolean
  isBlank: boolean
}

type SearchResultViewModel = {
  type: 'paper' | 'topic'
  id: string
  title: string
  detail: string
  dateKey?: string
}

type PageEvent = {
  currentTarget: {
    dataset: Record<string, unknown>
  }
}

type DateParts = { year: number; month: number; day: number }

const INBOX_TOPIC_ID = '__inbox__'
const DEFAULT_DATE = '2026-08-27'
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

Page({
  data: {
    statusBarHeight: 0,
    papers: [] as PaperViewModel[],
    timelinePapers: [] as PaperViewModel[],
    topics: [] as TopicViewModel[],
    weekDays: [] as WeekDayViewModel[],
    monthDays: [] as MonthDayViewModel[],
    searchResults: [] as SearchResultViewModel[],
    selectedPaper: null as PaperViewModel | null,
    selectedDate: DEFAULT_DATE,
    selectedTopicId: '',
    selectedDateLabel: '8月27日',
    monthLabel: '2026年8月',
    monthTitle: '八月',
    timelineTitle: '当天的纸页',
    searchQuery: '',
    newTopicName: '',
    inboxCount: 0,
    problemCount: 0,
    paperCount: 0,
    topicCount: 0,
    isLoading: false,
    isDrawerOpen: false,
    isSearchOpen: false,
    isReviewOpen: false,
    isProblemsOpen: false,
    isDetailOpen: false,
    isTopicFormOpen: false,
    isCreatingTopic: false,
    organizingId: '',
  },

  onShow() {
    monitor.track(MONITOR_EVENTS.HOME_VIEW)
    void this.loadHome()
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: systemInfo.statusBarHeight ?? 0 })
  },

  onPullDownRefresh() {
    void this.loadHome()
  },

  async loadHome() {
    this.setData({ isLoading: true })
    try {
      const api = getMockPapersApi()
      const [paperPage, topics] = await Promise.all([api.list(), api.listTopics()])
      this.setData({ papers: paperPage.items.map(toPaperViewModel) })
      this.applyDerivedData(topics)
    } catch (error) {
      monitor.captureError(error, { action: MONITOR_EVENTS.HOME_LOAD_FAILED })
      wx.showToast({ title: '内容加载失败', icon: 'none' })
    } finally {
      this.setData({ isLoading: false })
      wx.stopPullDownRefresh()
    }
  },

  startWriting() {
    monitor.track(MONITOR_EVENTS.HOME_OPEN_NOTE_EDITOR)
    wx.navigateTo({
      url: ROUTES.NOTE_EDITOR,
      fail: (error) =>
        monitor.captureError(error, { action: MONITOR_EVENTS.HOME_OPEN_NOTE_EDITOR }),
    })
  },

  openDrawer() {
    monitor.track(MONITOR_EVENTS.HOME_DRAWER_OPEN)
    this.setData({ isDrawerOpen: true })
  },

  closeDrawer() {
    monitor.track(MONITOR_EVENTS.HOME_DRAWER_CLOSE)
    this.setData({ isDrawerOpen: false })
  },

  selectDate(event: PageEvent) {
    const dateKey = String(event.currentTarget.dataset.date)
    monitor.track(MONITOR_EVENTS.HOME_DATE_SELECT, { dateKey })
    this.setData({ selectedDate: dateKey, isDrawerOpen: false })
    this.applyDerivedData(this.data.topics)
  },

  selectTopic(event: PageEvent) {
    const topicId = String(event.currentTarget.dataset.id)
    const selectedTopicId = this.data.selectedTopicId === topicId ? '' : topicId
    monitor.track(MONITOR_EVENTS.HOME_TOPIC_SELECT, { topicId: selectedTopicId })
    this.setData({ selectedTopicId, isDrawerOpen: false })
    this.applyDerivedData(this.data.topics)
  },

  showInbox() {
    monitor.track(MONITOR_EVENTS.HOME_TOPIC_SELECT, { topicId: INBOX_TOPIC_ID })
    this.setData({ selectedTopicId: INBOX_TOPIC_ID, isDrawerOpen: false })
    this.applyDerivedData(this.data.topics)
  },

  openSearch() {
    monitor.track(MONITOR_EVENTS.HOME_SEARCH_OPEN)
    this.setData({ isDrawerOpen: false, isSearchOpen: true })
  },

  closeSearch() {
    this.setData({ isSearchOpen: false, searchQuery: '', searchResults: [] })
  },

  onSearchInput(event: WechatMiniprogram.Input) {
    const searchQuery = event.detail.value
    this.setData({
      searchQuery,
      searchResults: buildSearchResults(searchQuery, this.data.papers, this.data.topics),
    })
  },

  selectSearchResult(event: PageEvent) {
    const type = String(event.currentTarget.dataset.type) as SearchResultViewModel['type']
    const id = String(event.currentTarget.dataset.id)
    const result = this.data.searchResults.find((item) => item.type === type && item.id === id)
    if (!result) {
      return
    }
    this.setData({ isSearchOpen: false, searchQuery: '', searchResults: [] })
    if (result.type === 'topic') {
      this.setData({ selectedTopicId: result.id })
      this.applyDerivedData(this.data.topics)
      return
    }
    if (result.dateKey) {
      this.setData({ selectedDate: result.dateKey })
      this.applyDerivedData(this.data.topics)
    }
    this.openPaperById(result.id)
  },

  openPaper(event: PageEvent) {
    this.openPaperById(String(event.currentTarget.dataset.id))
  },

  closePaper() {
    this.setData({ isDetailOpen: false, selectedPaper: null })
  },

  openReview() {
    monitor.track(MONITOR_EVENTS.HOME_REVIEW_OPEN)
    this.setData({ isDrawerOpen: false, isReviewOpen: true })
  },

  closeReview() {
    this.setData({ isReviewOpen: false })
  },

  openProblems() {
    monitor.track(MONITOR_EVENTS.HOME_PROBLEMS_OPEN)
    this.setData({ isDrawerOpen: false, isProblemsOpen: true })
  },

  closeProblems() {
    this.setData({ isProblemsOpen: false })
  },

  toggleTopicForm() {
    this.setData({ isTopicFormOpen: !this.data.isTopicFormOpen })
  },

  onTopicNameInput(event: WechatMiniprogram.Input) {
    this.setData({ newTopicName: event.detail.value })
  },

  async createTopic() {
    const name = this.data.newTopicName.trim()
    if (!name) {
      wx.showToast({ title: '给主题起个名字', icon: 'none' })
      return
    }
    if (this.data.isCreatingTopic) {
      return
    }
    this.setData({ isCreatingTopic: true })
    monitor.track(MONITOR_EVENTS.HOME_TOPIC_CREATE)
    try {
      const api = getMockPapersApi()
      await api.createTopic({ name })
      const topics = await api.listTopics()
      this.setData({ newTopicName: '', isTopicFormOpen: false })
      this.applyDerivedData(topics)
      wx.showToast({ title: '主题已创建', icon: 'success' })
    } catch (error) {
      monitor.captureError(error, { action: MONITOR_EVENTS.HOME_TOPIC_CREATE_FAILED })
      wx.showToast({ title: '主题创建失败', icon: 'none' })
    } finally {
      this.setData({ isCreatingTopic: false })
    }
  },

  async organizePaper(event: PageEvent) {
    const { id, version } = event.currentTarget.dataset
    if (this.data.organizingId) {
      return
    }
    this.setData({ organizingId: String(id) })
    monitor.track(MONITOR_EVENTS.HOME_ORGANIZE_CLICK)
    try {
      await getMockPapersApi().organize({
        id: String(id),
        version: Number(version),
        topicId: MOCK_TOPIC_ID,
      })
      monitor.track(MONITOR_EVENTS.HOME_ORGANIZE_SUCCESS)
      wx.showToast({ title: '已归入学习方法', icon: 'success' })
      await this.loadHome()
    } catch (error) {
      monitor.captureError(error, { action: MONITOR_EVENTS.HOME_ORGANIZE_FAILED })
      wx.showToast({ title: '整理失败，请重试', icon: 'none' })
    } finally {
      this.setData({ organizingId: '' })
    }
  },

  noop() {
    wx.showToast({ title: '问题契约将在后续接入', icon: 'none' })
  },

  applyDerivedData(topics: MockTopic[]) {
    const papers = this.data.papers
    const selectedDate = this.data.selectedDate || DEFAULT_DATE
    const selectedTopicId = this.data.selectedTopicId
    const paperCountByTopic = countPapersByTopic(papers)
    const viewTopics = topics.map((topic) => ({
      ...topic,
      paperCount: paperCountByTopic[topic.id] ?? 0,
      isSelected: topic.id === selectedTopicId,
    }))
    const timelinePapers = papers.filter((paper) => {
      if (paper.dateKey !== selectedDate) {
        return false
      }
      if (selectedTopicId === INBOX_TOPIC_ID) {
        return paper.isInbox
      }
      return !selectedTopicId || paper.topicId === selectedTopicId
    })
    const selected = parseDateKey(selectedDate)
    this.setData({
      topics: viewTopics,
      weekDays: buildWeekDays(selectedDate, papers),
      monthDays: buildMonthDays(selected, papers),
      timelinePapers,
      selectedDateLabel: formatDateLabel(selected),
      monthLabel: `${selected.year}年${selected.month}月`,
      monthTitle: formatMonthTitle(selected.month),
      timelineTitle:
        selectedTopicId === INBOX_TOPIC_ID ? '待整理' : selectedTopicId ? '主题纸页' : '当天的纸页',
      inboxCount: papers.filter((paper) => paper.isInbox).length,
      problemCount: 0,
      paperCount: papers.length,
      topicCount: topics.length,
    })
  },

  openPaperById(id: string) {
    const paper = this.data.papers.find((item) => item.id === id)
    if (!paper) {
      return
    }
    monitor.track(MONITOR_EVENTS.HOME_DETAIL_OPEN, { paperId: id })
    this.setData({ selectedPaper: paper, isDetailOpen: true })
  },
})

function toPaperViewModel(paper: Paper): PaperViewModel {
  const date = new Date(paper.createdAt)
  return {
    ...paper,
    dateKey: toDateKey(date),
    dateLabel: `${date.getMonth() + 1}月${date.getDate()}日`,
    timeLabel: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    topicLabel: paper.topicId ? '已归入主题' : '待整理',
    isInbox: paper.status === 'inbox',
  }
}

function buildWeekDays(selectedDate: string, papers: PaperViewModel[]): WeekDayViewModel[] {
  const selected = parseDateKey(selectedDate)
  const selectedDateObject = new Date(selected.year, selected.month - 1, selected.day, 12)
  const mondayOffset = (selectedDateObject.getDay() + 6) % 7
  const start = new Date(selectedDateObject)
  start.setDate(start.getDate() - mondayOffset)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const dateKey = toDateKey(date)
    const paperCount = papers.filter((paper) => paper.dateKey === dateKey).length
    return {
      dateKey,
      dayLabel: String(date.getDate()),
      weekdayLabel: WEEKDAY_LABELS[index] ?? '',
      paperCount,
      stack: Array.from({ length: Math.min(paperCount, 3) }, (_, stackIndex) => stackIndex),
      hasMore: paperCount > 3,
      isSelected: dateKey === selectedDate,
    }
  })
}

function buildMonthDays(selected: DateParts, papers: PaperViewModel[]): MonthDayViewModel[] {
  const firstDay = new Date(selected.year, selected.month - 1, 1)
  const blanks = (firstDay.getDay() + 6) % 7
  const lastDay = new Date(selected.year, selected.month, 0).getDate()
  const days: MonthDayViewModel[] = Array.from({ length: blanks }, (_, index) => ({
    dateKey: `blank-${index}`,
    dayLabel: '',
    paperCount: 0,
    level: 0,
    isSelected: false,
    isBlank: true,
  }))
  for (let day = 1; day <= lastDay; day += 1) {
    const dateKey = `${selected.year}-${pad(selected.month)}-${pad(day)}`
    const paperCount = papers.filter((paper) => paper.dateKey === dateKey).length
    days.push({
      dateKey,
      dayLabel: String(day),
      paperCount,
      level: Math.min(paperCount, 3),
      isSelected: dateKey === `${selected.year}-${pad(selected.month)}-${pad(selected.day)}`,
      isBlank: false,
    })
  }
  return days
}

function buildSearchResults(
  query: string,
  papers: PaperViewModel[],
  topics: TopicViewModel[],
): SearchResultViewModel[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
  if (!normalizedQuery) {
    return []
  }
  const topicResults = topics
    .filter((topic) => topic.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
    .map((topic) => ({
      type: 'topic' as const,
      id: topic.id,
      title: topic.name,
      detail: `${topic.paperCount} 张纸页 · 主题`,
    }))
  const paperResults = papers
    .filter((paper) =>
      `${paper.content} ${paper.topicLabel}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
    )
    .map((paper) => ({
      type: 'paper' as const,
      id: paper.id,
      title: paper.topicLabel,
      detail: `${paper.dateLabel} · ${paper.content}`,
      dateKey: paper.dateKey,
    }))
  return [...topicResults, ...paperResults].slice(0, 20)
}

function parseDateKey(value: string): DateParts {
  const [year, month, day] = value.split('-').map(Number)
  return {
    year: Number.isInteger(year) ? year : 2026,
    month: Number.isInteger(month) ? month : 8,
    day: Number.isInteger(day) ? day : 27,
  }
}

function countPapersByTopic(papers: PaperViewModel[]): Record<string, number> {
  return papers.reduce<Record<string, number>>((result, paper) => {
    if (paper.topicId) {
      result[paper.topicId] = (result[paper.topicId] ?? 0) + 1
    }
    return result
  }, {})
}

function formatDateLabel(date: DateParts): string {
  return `${date.month}月${date.day}日`
}

function formatMonthTitle(month: number): string {
  const monthNames = [
    '',
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
    '九月',
    '十月',
    '十一月',
    '十二月',
  ]
  return monthNames[month] ?? `${month}月`
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
