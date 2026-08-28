import { MONITOR_EVENTS } from '../../constants/events'
import { ROUTES } from '../../constants/routes'
import { monitor } from '../../services/monitor-adapter'
import {
  getMockPapersApi,
  MOCK_TOPIC_ID,
  type MockPaperMetadata,
  type MockTopic,
} from '../../services/mock-papers'
import type { Paper } from '@studycommit/rpc-contracts/papers'
import {
  formatDisplayCount,
  getDrawerTopicSummary,
  getHomeLoadErrorMessage,
  getNextDefaultTopicName,
} from './home-utils'

type PaperViewModel = Paper & {
  dateKey: string
  dateLabel: string
  timeLabel: string
  topicLabel: string
  isInbox: boolean
  hasQuestion: boolean
  isQuestionResolved: boolean
  photoPath: string
  templateClass: 'template-dot' | 'template-rule' | 'template-grid' | 'template-plain'
}

type TopicViewModel = MockTopic & {
  paperCount: number
  paperCountLabel: string
  isSelected: boolean
}

type WeekDayViewModel = {
  dateKey: string
  dayLabel: string
  paperCount: number
  stack: number[]
  hasMore: boolean
  isToday: boolean
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

type DrawerRowEvent = {
  detail: {
    action: 'topic' | 'inbox' | 'problems'
    itemId: string
  }
}

type DateParts = { year: number; month: number; day: number }

const INBOX_TOPIC_ID = '__inbox__'
const DEFAULT_DATE = '2026-08-25'
const DEMO_TODAY_DATE = '2026-08-25'
let timelineSwapTimer: ReturnType<typeof setTimeout> | undefined
let agentTransitionTimer: ReturnType<typeof setTimeout> | undefined
let loadSequence = 0
const PAPER_PRESENTATION = {
  '11111111-1111-4111-8111-111111111111': {
    topicLabel: '系统设计',
    templateClass: 'template-rule',
  },
  '22222222-2222-4222-8222-222222222222': {
    topicLabel: '待整理',
    templateClass: 'template-dot',
  },
  '44444444-4444-4444-8444-444444444444': {
    topicLabel: '移动端设计',
    templateClass: 'template-grid',
  },
  '55555555-5555-4555-8555-555555555555': {
    topicLabel: '待整理',
    templateClass: 'template-plain',
  },
} as const

Page({
  data: {
    statusBarHeight: 0,
    papers: [] as PaperViewModel[],
    timelinePapers: [] as PaperViewModel[],
    topics: [] as TopicViewModel[],
    visibleTopics: [] as TopicViewModel[],
    weekDays: [] as WeekDayViewModel[],
    monthDays: [] as MonthDayViewModel[],
    searchResults: [] as SearchResultViewModel[],
    problemPapers: [] as PaperViewModel[],
    selectedPaper: null as PaperViewModel | null,
    selectedDate: DEFAULT_DATE,
    selectedTopicId: '',
    selectedDateLabel: '8月25日',
    monthLabel: '2026年8月',
    monthDisplayLabel: '2026 年 8 月',
    monthTitle: '八月',
    timelineTitle: '当天的纸页',
    searchQuery: '',
    newTopicName: '',
    inboxCount: 0,
    inboxCountLabel: '0',
    problemCount: 0,
    problemCountLabel: '0',
    paperCount: 0,
    topicCount: 0,
    hasMoreTopics: false,
    topicOverflowLabel: '',
    isLoading: false,
    isLoadError: false,
    loadErrorMessage: '',
    isDrawerOpen: false,
    isSearchOpen: false,
    isReviewOpen: false,
    isProblemsOpen: false,
    isTopicsOpen: false,
    isDetailOpen: false,
    isDetailManageOpen: false,
    isTopicChoicesOpen: false,
    isAgentOpen: false,
    agentStep: 0,
    agentStepLabel: '1 / 3',
    agentOffsetX: 0,
    agentTransform: 'translate3d(0, 0, 0)',
    agentOpacity: 1,
    agentCardTitle: '',
    agentCardBody: '',
    agentCardExample: '',
    agentTouchStartX: 0,
    isTopicFormOpen: false,
    isCreatingTopic: false,
    organizingId: '',
    isTimelineSwapping: false,
  },

  onShow() {
    monitor.track(MONITOR_EVENTS.HOME_VIEW)
    void this.loadHome()
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: systemInfo.statusBarHeight ?? 0 })
  },

  onUnload() {
    if (timelineSwapTimer) {
      clearTimeout(timelineSwapTimer)
    }
    if (agentTransitionTimer) {
      clearTimeout(agentTransitionTimer)
    }
    loadSequence += 1
  },

  onPullDownRefresh() {
    void this.loadHome()
  },

  async loadHome() {
    const currentLoad = ++loadSequence
    this.setData({ isLoading: true, isLoadError: false, loadErrorMessage: '' })
    try {
      const api = getMockPapersApi()
      const [paperPage, topics, metadata] = await Promise.all([
        api.list(),
        api.listTopics(),
        api.listPaperMetadata(),
      ])
      if (currentLoad !== loadSequence) {
        return
      }
      const metadataByPaperId = new Map(metadata.map((item) => [item.paperId, item]))
      this.setData({
        papers: paperPage.items.map((paper) => toPaperViewModel(paper, metadataByPaperId)),
      })
      this.applyDerivedData(topics)
    } catch (error) {
      if (currentLoad !== loadSequence) {
        return
      }
      monitor.captureError(error, { action: MONITOR_EVENTS.HOME_LOAD_FAILED })
      this.setData({ isLoadError: true, loadErrorMessage: getHomeLoadErrorMessage(error) })
      wx.showToast({ title: '内容加载失败', icon: 'none' })
    } finally {
      if (currentLoad === loadSequence) {
        this.setData({ isLoading: false })
        wx.stopPullDownRefresh()
      }
    }
  },

  retryLoad() {
    void this.loadHome()
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
    this.playTimelineSwap()
  },

  playTimelineSwap() {
    if (timelineSwapTimer) {
      clearTimeout(timelineSwapTimer)
    }
    this.setData({ isTimelineSwapping: false })
    wx.nextTick(() => {
      this.setData({ isTimelineSwapping: true })
      timelineSwapTimer = setTimeout(() => this.setData({ isTimelineSwapping: false }), 220)
    })
  },

  selectTopic(event: PageEvent) {
    const topicId = String(event.currentTarget.dataset.id)
    const selectedTopicId = this.data.selectedTopicId === topicId ? '' : topicId
    monitor.track(MONITOR_EVENTS.HOME_TOPIC_SELECT, { topicId: selectedTopicId })
    this.setData({ selectedTopicId, isDrawerOpen: false, isTopicsOpen: false })
    this.applyDerivedData(this.data.topics)
  },

  onDrawerRowSelect(event: DrawerRowEvent) {
    const { action, itemId } = event.detail
    if (action === 'topic') {
      this.selectTopic({ currentTarget: { dataset: { id: itemId } } })
      return
    }
    if (action === 'inbox') {
      this.showInbox()
      return
    }
    this.openProblems()
  },

  openTopics() {
    monitor.track(MONITOR_EVENTS.HOME_TOPICS_OPEN)
    this.setData({ isDrawerOpen: false, isTopicsOpen: true })
  },

  closeTopics() {
    this.setData({ isTopicsOpen: false })
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

  clearSearch() {
    this.setData({ searchQuery: '', searchResults: [] })
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
    this.setData({ isDetailOpen: false, isDetailManageOpen: false, selectedPaper: null })
  },

  openDetailManage() {
    this.setData({ isDetailManageOpen: true, isTopicChoicesOpen: false })
  },

  closeDetailManage() {
    this.setData({ isDetailManageOpen: false, isTopicChoicesOpen: false })
  },

  openTopicChoices() {
    this.setData({ isTopicChoicesOpen: true })
  },

  keepDetailManageOpen() {
    return
  },

  selectDetailTopic(event: PageEvent) {
    const topicId = String(event.currentTarget.dataset.id)
    const selectedPaper = this.data.selectedPaper
    if (!selectedPaper) {
      return
    }
    this.closeDetailManage()
    void this.organizePaper({
      currentTarget: { dataset: { id: selectedPaper.id, version: selectedPaper.version, topicId } },
    })
  },

  openAgent() {
    const paper = this.data.selectedPaper
    if (!paper?.hasQuestion) {
      return
    }
    const explanation = getAgentExplanation(paper, 0)
    monitor.track(MONITOR_EVENTS.HOME_AGENT_OPEN)
    this.setData({
      isAgentOpen: true,
      agentStep: 0,
      agentStepLabel: '1 / 3',
      agentTransform: 'translate3d(0, 0, 0)',
      agentOpacity: 1,
      agentCardTitle: explanation.title,
      agentCardBody: explanation.body,
      agentCardExample: explanation.example,
    })
  },

  closeAgent() {
    this.setData({
      isAgentOpen: false,
      agentOffsetX: 0,
      agentTransform: 'translate3d(0, 0, 0)',
      agentOpacity: 1,
    })
  },

  onAgentTouchStart(event: WechatMiniprogram.TouchEvent) {
    this.setData({ agentTouchStartX: event.touches[0]?.clientX ?? 0, agentOffsetX: 0 })
  },

  onAgentTouchMove(event: WechatMiniprogram.TouchEvent) {
    const startX = this.data.agentTouchStartX
    const currentX = event.touches[0]?.clientX ?? startX
    const offsetX = Math.max(-180, Math.min(180, currentX - startX))
    this.setData({
      agentOffsetX: offsetX,
      agentTransform: `translate3d(${offsetX}px, 0, 0) rotate(${offsetX / 24}deg)`,
      agentOpacity: 1 - Math.min(0.45, Math.abs(offsetX) / 400),
    })
  },

  onAgentTouchEnd() {
    const offsetX = this.data.agentOffsetX
    if (Math.abs(offsetX) < 80) {
      this.setData({ agentOffsetX: 0, agentTransform: 'translate3d(0, 0, 0)', agentOpacity: 1 })
      return
    }
    const direction = offsetX < 0 ? 'left' : 'right'
    this.setData({
      agentTransform: `translate3d(${direction === 'left' ? '-120%' : '120%'}, 0, 0) rotate(${direction === 'left' ? '-8deg' : '8deg'})`,
      agentOpacity: 0,
    })
    if (agentTransitionTimer) {
      clearTimeout(agentTransitionTimer)
    }
    agentTransitionTimer = setTimeout(() => {
      if (direction === 'right' || this.data.agentStep >= 2) {
        monitor.track(MONITOR_EVENTS.HOME_AGENT_FINISH, { direction })
        this.closeAgent()
        wx.showToast({
          title: direction === 'right' ? '这部分已经理解' : '这次先到这里',
          icon: 'none',
        })
        return
      }
      const nextStep = this.data.agentStep + 1
      const paper = this.data.selectedPaper
      if (!paper) {
        this.closeAgent()
        return
      }
      const explanation = getAgentExplanation(paper, nextStep)
      this.setData({
        agentStep: nextStep,
        agentStepLabel: `${nextStep + 1} / 3`,
        agentTransform: 'translate3d(0, 0, 0)',
        agentOpacity: 1,
        agentCardTitle: explanation.title,
        agentCardBody: explanation.body,
        agentCardExample: explanation.example,
      })
    }, 220)
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

  async resolveQuestion() {
    const selectedPaper = this.data.selectedPaper
    if (!selectedPaper || selectedPaper.isQuestionResolved) {
      return
    }
    try {
      await getMockPapersApi().resolveQuestion(selectedPaper.id)
      this.closeDetailManage()
      await this.loadHome()
      const refreshedPaper = this.data.papers.find((paper) => paper.id === selectedPaper.id)
      this.setData({ selectedPaper: refreshedPaper ?? null, isDetailOpen: Boolean(refreshedPaper) })
      wx.showToast({ title: '问题已标记为解决', icon: 'success' })
    } catch (error) {
      monitor.captureError(error, { action: MONITOR_EVENTS.HOME_ORGANIZE_FAILED })
      wx.showToast({ title: '暂时无法更新，请重试', icon: 'none' })
    }
  },

  toggleTopicForm() {
    this.setData({ isTopicFormOpen: !this.data.isTopicFormOpen })
  },

  async createDefaultTopic() {
    if (this.data.isCreatingTopic) {
      return
    }
    const name = getNextDefaultTopicName(this.data.topics.map((topic) => topic.name))
    this.setData({ isCreatingTopic: true })
    monitor.track(MONITOR_EVENTS.HOME_TOPIC_CREATE, { source: 'quick', name })
    try {
      const api = getMockPapersApi()
      await api.createTopic({ name })
      const topics = await api.listTopics()
      this.setData({ newTopicName: '', isTopicFormOpen: false })
      this.applyDerivedData(topics)
      wx.showToast({ title: '箱子已新建', icon: 'success' })
    } catch (error) {
      monitor.captureError(error, {
        action: MONITOR_EVENTS.HOME_TOPIC_CREATE_FAILED,
        source: 'quick',
      })
      wx.showToast({ title: '新建箱子失败', icon: 'none' })
    } finally {
      this.setData({ isCreatingTopic: false })
    }
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
    const { id, version, topicId } = event.currentTarget.dataset
    if (this.data.organizingId) {
      return
    }
    this.setData({ organizingId: String(id) })
    monitor.track(MONITOR_EVENTS.HOME_ORGANIZE_CLICK)
    try {
      await getMockPapersApi().organize({
        id: String(id),
        version: Number(version),
        topicId: String(topicId ?? MOCK_TOPIC_ID),
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
      paperCountLabel: formatDisplayCount(paperCountByTopic[topic.id] ?? 0),
      isSelected: topic.id === selectedTopicId,
    }))
    const drawerTopics = getDrawerTopicSummary(viewTopics)
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
    const weekDays = buildWeekDays(selectedDate, papers)
    this.setData({
      topics: viewTopics,
      visibleTopics: drawerTopics.visibleTopics,
      hasMoreTopics: drawerTopics.hasMoreTopics,
      topicOverflowLabel: drawerTopics.topicOverflowLabel,
      weekDays,
      monthDays: buildMonthDays(selected, papers),
      timelinePapers,
      problemPapers: papers.filter((paper) => paper.hasQuestion && !paper.isQuestionResolved),
      selectedDateLabel: formatDateLabel(selected),
      monthLabel: `${selected.year}年${selected.month}月`,
      monthDisplayLabel: `${selected.year} 年 ${selected.month} 月`,
      monthTitle: formatMonthTitle(selected.month),
      timelineTitle:
        selectedTopicId === INBOX_TOPIC_ID ? '待整理' : selectedTopicId ? '主题纸页' : '当天的纸页',
      inboxCount: papers.filter((paper) => paper.isInbox).length,
      inboxCountLabel: formatDisplayCount(papers.filter((paper) => paper.isInbox).length),
      problemCount: papers.filter((paper) => paper.hasQuestion && !paper.isQuestionResolved).length,
      problemCountLabel: formatDisplayCount(
        papers.filter((paper) => paper.hasQuestion && !paper.isQuestionResolved).length,
      ),
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

function toPaperViewModel(
  paper: Paper,
  metadataByPaperId: ReadonlyMap<string, MockPaperMetadata>,
): PaperViewModel {
  const date = new Date(paper.createdAt)
  const presentation = PAPER_PRESENTATION[paper.id as keyof typeof PAPER_PRESENTATION]
  const metadata = metadataByPaperId.get(paper.id)
  return {
    ...paper,
    dateKey: toDateKey(date),
    dateLabel: `${date.getMonth() + 1}月${date.getDate()}日`,
    timeLabel: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    topicLabel: presentation?.topicLabel ?? (paper.topicId ? '已归入主题' : '待整理'),
    isInbox: paper.status === 'inbox',
    hasQuestion: metadata?.hasQuestion ?? false,
    isQuestionResolved: metadata?.isQuestionResolved ?? false,
    photoPath: metadata?.photoPath ?? '',
    templateClass: presentation?.templateClass ?? 'template-plain',
  }
}

function getAgentExplanation(
  paper: PaperViewModel,
  step: number,
): { title: string; body: string; example: string } {
  if (paper.content.includes('费曼')) {
    if (step === 0) {
      return {
        title: '先把“复述”换成检验',
        body: '费曼学习法不是把原话再说一遍，而是尝试用自己的话讲清楚。讲不下去的地方，就是还没有真正理解的地方。',
        example: '先合上资料，用一句自己的话解释一个概念，再回头检查遗漏。',
      }
    }
    if (step === 1) {
      return {
        title: '把卡住的地方拆小',
        body: '如果一句话讲不清，不必重新学习全部内容。先找出具体卡点：是概念不熟、因果关系不清，还是缺少一个例子。',
        example: '把“我不懂”改成“我不懂它为什么会导致这个结果”。',
      }
    }
    return {
      title: '用一个反例确认理解',
      body: '真正理解不只是在熟悉的例子里复述，还能判断结论什么时候成立、什么时候不成立。',
      example: '试着找一个不适用的场景，再说明它为什么不适用。',
    }
  }
  return {
    title: step === 0 ? '先把原记录换成一句解释' : '再换一个角度',
    body:
      step === 0
        ? `${paper.content} 可以先拆成“它解决什么问题”和“在什么条件下成立”两部分理解。`
        : '先从一个具体场景开始，再回到抽象结论，会更容易确认每个词的含义。',
    example: '尝试找一个符合结论的例子，再找一个不符合的反例。',
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
      paperCount,
      stack: Array.from({ length: Math.min(paperCount, 3) }, (_, stackIndex) => stackIndex),
      hasMore: paperCount > 3,
      isToday: dateKey === DEMO_TODAY_DATE,
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
