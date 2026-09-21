import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { PuzzleAlbum } from '@studycommit/rpc-contracts/puzzles'
import {
  motion,
  radii,
  spacing,
  studyCommitMistBlueColors as colors,
  typography,
} from '@studycommit/design-tokens'
import {
  selectGroup,
  type PuzzlePaper,
  type PuzzleState,
  type PuzzleTopic,
  type ScratchPoint,
} from '@studycommit/common/puzzle-runtime'
import { PuzzleArt } from './PuzzleArt'
import { Reward } from './Reward'

export type PuzzleCloudHost = {
  album(): Promise<PuzzleAlbum>
  selectArtwork(artworkId: string): Promise<PuzzleAlbum>
  organize(paperId: string, topicId: string): Promise<void>
  reveal(rewardId: string): Promise<void>
  featureArtwork(artworkId: string): Promise<PuzzleAlbum>
  loadStrokes(rewardId: string): Promise<ScratchPoint[]>
  saveStrokes(rewardId: string, strokes: ScratchPoint[]): Promise<void>
}

export function CloudPuzzleExperience({
  host,
  papers,
  topics,
  onClose,
}: {
  host: PuzzleCloudHost
  papers: PuzzlePaper[]
  topics: PuzzleTopic[]
  onClose: () => void
}) {
  const [album, setAlbum] = useState<PuzzleAlbum | null>(null),
    [error, setError] = useState('')
  const [busy, setBusy] = useState(false),
    [view, setView] = useState<'album' | 'group' | 'reward'>('album')
  const [group, setGroup] = useState<PuzzlePaper[]>([]),
    [position, setPosition] = useState(0)
  const [topic, setTopic] = useState(''),
    [strokes, setStrokes] = useState<ScratchPoint[]>([])
  const [justCompleted, setJustCompleted] = useState(false)
  const reload = async () => {
    setAlbum(await host.album())
  }
  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : '画册读取失败'))
  }, [host])
  const selected = album?.artworks.find((a) => a.id === album.selectedArtworkId)
  const rewards = album?.rewards.filter((r) => r.artworkId === selected?.id) ?? []
  const pending = rewards.find((r) => !r.revealedAt)
  useEffect(() => {
    if (pending) {
void host
        .loadStrokes(pending.id)
        .then(setStrokes)
        .catch(() => setStrokes([]))
}
  }, [host, pending?.id])
  const state = useMemo<PuzzleState | null>(
    () =>
      album && selected
        ? {
            version: 1,
            counted: [],
            credit: album.credit,
            earned: rewards.map((r) => r.pieceIndex),
            lastRewardDay: null,
            pending: pending?.pieceIndex ?? null,
            strokes,
            intent: null,
          }
        : null,
    [album, selected, rewards, pending, strokes],
  )
  const run = async (task: () => Promise<void>) => {
    if (busy) {
return
}
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }
  const start = () => {
    setGroup(selectGroup(papers, new Date()))
    setPosition(0)
    setView('group')
  }
  const css = {
    '--p-paper': colors.paper,
    '--p-ink': colors.ink,
    '--p-muted': colors.muted,
    '--p-line': colors.lineStrong,
    '--p-action': colors.action,
    '--p-accent': colors.accent,
    '--p-canvas': colors.canvas,
    '--p-gap': `${spacing.lg}px`,
    '--p-radius': `${radii.sm}px`,
    '--p-body': `${typography.body.fontSize}px`,
    '--p-reveal': `${motion.puzzleReveal}ms`,
  } as CSSProperties
  const paper = group[position]
  const chooseArtwork = (artworkId: string) =>
    void run(async () => setAlbum(await host.selectArtwork(artworkId)))
  const artworkCard = (artwork: PuzzleAlbum['artworks'][number]) => (
    <button
      key={artwork.id}
      disabled={busy || artwork.status === 'retired'}
      onClick={() => chooseArtwork(artwork.id)}
    >
      <PuzzleArt
        pieces={artwork.completedAt ? Array.from({ length: 12 }, (_, i) => i) : []}
        assetKey={artwork.assetKey}
        assetUrl={artwork.assetUrl}
        title={artwork.title}
        complete={Boolean(artwork.completedAt)}
      />
      <strong>{artwork.title}</strong>
      <span>
        {artwork.completedAt
          ? `完成于 ${new Date(artwork.completedAt).toLocaleDateString('zh-CN')}`
          : artwork.description}
      </span>
    </button>
  )
  return (
    <div className="puzzle-app" style={css}>
      <header className="puzzle-top">
        <span>我的画册</span>
        <button aria-label="关闭画册" disabled={busy} onClick={onClose}>
          ×
        </button>
      </header>
      {error && (
        <div role="alert" className="puzzle-error">
          {error}
          <button onClick={() => void reload()}>重试</button>
        </div>
      )}
      {!album ? (
        <p>正在翻开画册…</p>
      ) : !selected ? (
        <section className="puzzle-album">
          <p className="puzzle-kicker">先选一幅想慢慢完成的画</p>
          <h2>从哪段风景开始？</h2>
          <h3>可以开始</h3>
          <div className="puzzle-artwork-grid">
            {album.artworks
              .filter((a) => a.status === 'published' && !a.completedAt)
              .map(artworkCard)}
          </div>
          {album.artworks.some((a) => a.completedAt) && (
            <>
              <h3>已经完成</h3>
              <div className="puzzle-artwork-grid puzzle-artwork-complete">
                {album.artworks.filter((a) => a.completedAt).map(artworkCard)}
              </div>
            </>
          )}
        </section>
      ) : view === 'reward' && state && pending ? (
        <Reward
          state={state}
          artwork={selected}
          onSave={(next) => {
            setStrokes(next)
            void host.saveStrokes(pending.id, next)
          }}
          onFinish={async () => {
            await host.reveal(pending.id)
            const next = await host.album()
            setAlbum(next)
            if (next.artworks.find((item) => item.id === selected.id)?.completedAt) {
              setJustCompleted(true)
              setView('album')
            }
            setStrokes([])
          }}
          onContinue={start}
          onAlbum={() => setView('album')}
        />
      ) : view === 'group' ? (
        <section className="puzzle-group">
          <button className="puzzle-link" onClick={() => setView('album')}>
            ← 返回画册
          </button>
          <p className="puzzle-kicker">
            旧记录，慢慢归位 · {Math.min(position + 1, group.length)} / {group.length}
          </p>
          <h2>{paper ? '给这条记录找个位置' : '这一组，先整理到这里'}</h2>
          {paper ? (
            <>
              <article className="puzzle-record">
                <time>{new Date(paper.createdAt).toLocaleDateString('zh-CN')}</time>
                <p>{paper.content || '这是一条图片记录。'}</p>
              </article>
              <label className="puzzle-topic">
                放入主题
                <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                  <option value="">选择一个主题</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <footer className="puzzle-footer">
                <button onClick={() => setPosition((p) => p + 1)}>稍后处理</button>
                <button
                  className="puzzle-primary"
                  disabled={!topic || busy}
                  onClick={() =>
                    void run(async () => {
                      await host.organize(paper.id, topic)
                      await reload()
                      setPosition((p) => p + 1)
                      setTopic('')
                    })
                  }
                >
                  {busy ? '正在保存…' : '归入主题'}
                </button>
              </footer>
            </>
          ) : (
            <>
              <p>{group.length ? '跳过的记录留待下次。' : '当前没有可整理的旧记录。'}</p>
              <button onClick={start}>再整理一组</button>
            </>
          )}
          <p className="puzzle-footnote">已累计 {album.credit} / 3 条 · 每天最多一块</p>
          {pending && (
            <button className="puzzle-primary" onClick={() => setView('reward')}>
              擦开获得的碎片
            </button>
          )}
        </section>
      ) : (
        <section className="puzzle-album">
          {justCompleted && (
            <div className="puzzle-complete" role="status">
              <strong>这幅风景完成了</strong>
              <span>每一块都来自你认真的整理。</span>
            </div>
          )}
          <div className="puzzle-album-heading">
            <div>
              <p className="puzzle-kicker">当前收集</p>
              <h2>{selected.title}</h2>
            </div>
            <span>{rewards.filter((r) => r.revealedAt).length} / 12</span>
          </div>
          <div className="puzzle-album-art">
            <PuzzleArt
              pieces={rewards.filter((r) => r.revealedAt).map((r) => r.pieceIndex)}
              assetKey={selected.assetKey}
              assetUrl={selected.assetUrl}
              title={selected.title}
              complete={rewards.length === 12 && !pending}
            />
          </div>
          <p>{selected.description}</p>
          <footer className="puzzle-footer">
            {selected.completedAt ? (
              <>
                <button
                  className="puzzle-primary"
                  disabled={selected.featured || busy}
                  onClick={() =>
                    void run(async () => setAlbum(await host.featureArtwork(selected.id)))
                  }
                >
                  {selected.featured ? '已挂在首页' : '挂到首页'}
                </button>
                <button
                  onClick={() =>
                    void run(async () =>
                      setAlbum({ ...(await host.album()), selectedArtworkId: null }),
                    )
                  }
                >
                  开始下一幅
                </button>
              </>
            ) : (
              <button onClick={start}>整理一小组</button>
            )}
            {pending && (
              <button className="puzzle-primary" onClick={() => setView('reward')}>
                擦开一小块
              </button>
            )}
          </footer>
          <button
            className="puzzle-link"
            onClick={() =>
              void run(async () => setAlbum({ ...(await host.album()), selectedArtworkId: null }))
            }
          >
            查看其他画作
          </button>
        </section>
      )}
      <p className="puzzle-local-note">奖励进度已同步到账号；刮痕仅保存在本机。</p>
    </div>
  )
}
