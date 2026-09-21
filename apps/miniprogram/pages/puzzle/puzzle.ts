import type { PuzzleAlbum, PuzzleArtwork } from '@studycommit/rpc-contracts/puzzles'
import { getMiniprogramServices } from '../../infrastructure/services/service-context'
import {
  canvasTouchPoint,
  createOfflinePuzzleApi,
  scratchCellKey,
  selectGroup,
  type PuzzlePaper,
  type PuzzleTopic,
} from '@studycommit/common/puzzle-runtime'
import { getStoredSession } from '../../services/auth-session'

const CACHE_KEY = 'studycommit.puzzle.album.v1'
const puzzleClient = () =>
  createOfflinePuzzleApi({
    account: getStoredSession()?.user.id ?? 'anonymous',
    remote: getMiniprogramServices().puzzles,
    storage: {
      get: async (key) => {
        const value = wx.getStorageSync(key)
        return typeof value === 'string' ? value : null
      },
      set: async (key, value) => {
        wx.setStorageSync(key, value)
      },
    },
    createId: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  })

Page({
  data: {
    album: null as PuzzleAlbum | null,
    current: null as PuzzleArtwork | null,
    pendingId: '',
    revealed: [] as number[],
    loading: true,
    error: '',
    scratching: false,
    scratchProgress: 0,
    organizing: false,
    group: [] as PuzzlePaper[],
    topics: [] as PuzzleTopic[],
    position: 0,
    topicId: '',
  },
  cells: new Set<string>(),
  async onLoad() {
    await this.load()
  },
  async onShow() {
    if (!this.data.loading) {
await this.load()
}
  },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const album = await puzzleClient().album()
      wx.setStorageSync(CACHE_KEY, album)
      this.applyAlbum(album)
    } catch (error) {
      const cached = wx.getStorageSync(CACHE_KEY) as PuzzleAlbum | undefined
      if (cached?.artworks) {
this.applyAlbum(cached)
} else {
this.setData({ error: error instanceof Error ? error.message : '画册暂时无法读取' })
}
    } finally {
      this.setData({ loading: false })
    }
  },
  applyAlbum(album: PuzzleAlbum) {
    const current = album.artworks.find((item) => item.id === album.selectedArtworkId) ?? null
    const rewards = album.rewards.filter((item) => item.artworkId === current?.id)
    this.setData({
      album,
      current,
      pendingId: rewards.find((item) => !item.revealedAt)?.id ?? '',
      revealed: rewards.filter((item) => item.revealedAt).map((item) => item.pieceIndex),
    })
  },
  async selectArtwork(event: WechatMiniprogram.TouchEvent) {
    const artworkId = String(event.currentTarget.dataset.id)
    this.applyAlbum(await puzzleClient().selectArtwork(artworkId))
  },
  startScratch() {
    this.cells.clear()
    this.setData({ scratching: true, scratchProgress: 0 })
    const context = wx.createCanvasContext('scratch', this)
    context.setFillStyle('#c8c3b7')
    context.fillRect(0, 0, 300, 220)
    context.draw()
  },
  scratch(event: WechatMiniprogram.TouchEvent) {
    const touch = event.touches[0]
    if (!touch || !this.data.scratching) {
return
}
    const { x, y } = canvasTouchPoint(touch)
    this.cells.add(scratchCellKey(x, y))
    const context = wx.createCanvasContext('scratch', this)
    context.globalCompositeOperation = 'destination-out'
    context.beginPath()
    context.arc(x, y, 20, 0, Math.PI * 2)
    context.fill()
    context.draw(true)
    const scratchProgress = Math.min(100, this.cells.size * 4)
    this.setData({ scratchProgress })
    if (scratchProgress >= 55) {
void this.finishScratch()
}
  },
  async finishScratch() {
    if (!this.data.pendingId || !this.data.scratching) {
return
}
    this.setData({ scratching: false })
    await puzzleClient().reveal(this.data.pendingId)
    await this.load()
    wx.vibrateShort({ type: 'light' })
  },
  async goOrganize() {
    const services = getMiniprogramServices()
    const [page, topics] = await Promise.all([
      services.papers.list({ limit: 100 }),
      services.papers.listTopics(),
    ])
    this.setData({
      organizing: true,
      group: selectGroup(
        page.items.map((paper) => ({
          id: paper.id,
          content: paper.content,
          status: paper.status,
          createdAt: paper.createdAt,
          deletedAt: paper.deletedAt,
          topicId: paper.topicId,
        })),
        new Date(),
      ),
      topics,
      position: 0,
      topicId: '',
    })
  },
  chooseTopic(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ topicId: this.data.topics[Number(event.detail.value)]?.id ?? '' })
  },
  skipPaper() {
    this.setData({ position: this.data.position + 1, topicId: '' })
  },
  async organizePaper() {
    const paper = this.data.group[this.data.position]
    if (!paper || !this.data.topicId) {
return
}
    const current = await getMiniprogramServices().papers.get(paper.id)
    await getMiniprogramServices().papers.organize({
      id: paper.id,
      topicId: this.data.topicId,
      version: current.version,
    })
    this.setData({ position: this.data.position + 1, topicId: '' })
    await this.load()
  },
  closeOrganize() {
    this.setData({ organizing: false })
  },
  async feature() {
    if (!this.data.current) {
return
}
    this.applyAlbum(await puzzleClient().featureArtwork(this.data.current.id))
  },
})
