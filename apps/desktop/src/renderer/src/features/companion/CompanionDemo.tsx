import { useEffect, useState } from 'react'
import { LayeredCompanion, type CompanionMotion } from './LayeredCompanion'

type DemoPhase =
  | 'ready'
  | 'arrival'
  | 'settling'
  | 'focus'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'leaving'
  | 'gift-arrival'
  | 'completed'
  | 'reward'
  | 'kept'

type CompletionSource = 'study' | 'look'

const phaseCopy: Record<DemoPhase, { label: string; message: string }> = {
  ready: { label: '还在门外', message: '开始后，小猫才会因为你的行动走进画面。' },
  arrival: { label: '听见你了', message: '它从画外走进来，接近你时会慢下来。' },
  settling: { label: '正在坐下', message: '先停步、轻微下沉，再把走路姿势过渡到写字姿势。' },
  focus: { label: '一起写字', message: '进入稳定状态后，只留下轻微呼吸和铅笔沙沙的感觉。' },
  pausing: { label: '听见你停下', message: '写字动作先停住，它再慢慢把注意力转向你。' },
  paused: { label: '在等你', message: '它会从本子上抬头看你，但不催促。' },
  resuming: { label: '回到本子', message: '你继续时，它也把视线放回本子，再恢复写字。' },
  leaving: { label: '去拿今天的奖励', message: '它不会在原地突然变出礼物，而是转身离开一会儿。' },
  'gift-arrival': {
    label: '带着信封回来',
    message: '角色重新从画外进入，你能看懂奖励是它亲自带来的。',
  },
  completed: { label: '记得你的完成', message: '这次学习已经被它记住，信封正在等你接过。' },
  reward: {
    label: '打开小信封',
    message: '奖励先经过角色交付，再进入收藏，会比直接发道具更有情绪。',
  },
  kept: { label: '今天留下了痕迹', message: '星星贴纸已收进本周学习手帐，下次来还能看到。' },
}

const timedTransitions: Partial<Record<DemoPhase, { next: DemoPhase; duration: number }>> = {
  arrival: { next: 'settling', duration: 1100 },
  settling: { next: 'focus', duration: 420 },
  pausing: { next: 'paused', duration: 300 },
  resuming: { next: 'focus', duration: 260 },
  leaving: { next: 'gift-arrival', duration: 720 },
  'gift-arrival': { next: 'completed', duration: 850 },
}

const stageByPhase: Record<DemoPhase, number> = {
  ready: 0,
  arrival: 0,
  settling: 0,
  focus: 1,
  pausing: 2,
  paused: 2,
  resuming: 2,
  leaving: 3,
  'gift-arrival': 3,
  completed: 3,
  reward: 3,
  kept: 3,
}

function getMotion(phase: DemoPhase, completionSource: CompletionSource): CompanionMotion {
  switch (phase) {
    case 'ready':
      return 'waiting'
    case 'arrival':
      return 'arriving'
    case 'settling':
      return 'settling'
    case 'focus':
      return 'studying'
    case 'pausing':
      return 'pausing'
    case 'paused':
    case 'kept':
      return 'looking'
    case 'resuming':
      return 'resuming'
    case 'leaving':
      return completionSource === 'look' ? 'leaving-look' : 'leaving-study'
    case 'gift-arrival':
      return 'gift-arriving'
    case 'completed':
    case 'reward':
      return 'reward'
  }
}

export function CompanionDemo({ onExit }: { onExit: () => void }): React.JSX.Element {
  const [phase, setPhase] = useState<DemoPhase>('ready')
  const [completionSource, setCompletionSource] = useState<CompletionSource>('study')
  const [remaining, setRemaining] = useState(25 * 60)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const transition = timedTransitions[phase]
    if (!transition) {
      return
    }

    const timer = window.setTimeout(
      () => setPhase(transition.next),
      reducedMotion ? 90 : transition.duration,
    )
    return () => window.clearTimeout(timer)
  }, [phase, reducedMotion])

  useEffect(() => {
    if (phase !== 'focus') {
      return
    }
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        const next = Math.max(0, current - 15)
        if (next === 0) {
          window.setTimeout(() => {
            setCompletionSource('study')
            setPhase('leaving')
          }, 0)
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  const progress =
    phase === 'leaving' ||
    phase === 'gift-arrival' ||
    phase === 'completed' ||
    phase === 'reward' ||
    phase === 'kept'
      ? 100
      : Math.round(((25 * 60 - remaining) / (25 * 60)) * 100)
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const timeLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  function startSession() {
    setRemaining(25 * 60)
    setCompletionSource('study')
    setPhase('arrival')
  }

  function completeSession() {
    setRemaining(0)
    setCompletionSource(phase === 'paused' ? 'look' : 'study')
    setPhase('leaving')
  }

  const stage = stageByPhase[phase]

  return (
    <section
      className={`companion-demo miko-motion-demo${reducedMotion ? ' companion-demo--reduced' : ''}`}
    >
      <header className="companion-demo__header miko-motion-demo__header">
        <div>
          <p className="companion-demo__eyebrow">Miko 式实现思路 / 自然衔接版</p>
          <h2>你开始学，它才走过来</h2>
          <p className="companion-demo__intro">
            每次换姿势都有「准备—过渡—稳定」，不再像切 PPT 一样突然跳帧。
          </p>
        </div>
        <button type="button" className="button button--ghost" onClick={onExit}>
          退出 Demo
        </button>
      </header>

      <div className="companion-demo__workspace miko-motion-demo__workspace">
        <div
          className="companion-demo__scene miko-motion-demo__scene"
          aria-label="小猫位图陪学动画演示"
        >
          <LayeredCompanion
            motion={getMotion(phase, completionSource)}
            reducedMotion={reducedMotion}
          />

          <div className="miko-motion-demo__scene-topbar">
            <div>
              <span>今日专注</span>
              <strong>{phaseCopy[phase].label}</strong>
            </div>
            <time>{timeLabel}</time>
          </div>

          <div
            className="miko-motion-demo__progress"
            role="progressbar"
            aria-label="本次学习进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ transform: `scaleX(${progress / 100})` }} />
          </div>

          {phase === 'paused' ? (
            <div className="miko-motion-demo__speech">我在这里，慢慢来。</div>
          ) : null}

          {phase === 'reward' ? (
            <div className="miko-motion-demo__reward" role="dialog" aria-label="学习奖励">
              <span className="miko-motion-demo__reward-star" aria-hidden="true">
                ★
              </span>
              <p>今天的学习留下了</p>
              <h3>一枚「安静写字」贴纸</h3>
              <button type="button" className="button" onClick={() => setPhase('kept')}>
                收进本周手帐
              </button>
            </div>
          ) : null}

          {phase === 'kept' ? (
            <div className="miko-motion-demo__kept" aria-live="polite">
              <span aria-hidden="true">★</span>
              <div>
                <strong>本周第 3 次完成</strong>
                <small>它会记得你们一起学过</small>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="companion-demo__panel miko-motion-demo__panel">
          <div className="companion-status">
            <span className="companion-status__dot" />
            <div>
              <span className="companion-status__label">当前动作</span>
              <strong>{phaseCopy[phase].label}</strong>
            </div>
          </div>

          <p className="companion-demo__feedback" aria-live="polite">
            {phaseCopy[phase].message}
          </p>

          <div className="miko-motion-demo__timeline" aria-label="动画组成">
            {['走入', '陪学', '抬头', '交付'].map((label, index) => (
              <div
                key={label}
                className={index < stage ? 'is-done' : index === stage ? 'is-active' : ''}
              >
                <span />
                <small>{label}</small>
              </div>
            ))}
          </div>

          <div className="companion-demo__controls miko-motion-demo__controls">
            {phase === 'ready' || phase === 'kept' ? (
              <button type="button" className="button" onClick={startSession}>
                {phase === 'kept' ? '再陪我学一次' : '开始 25 分钟陪学'}
              </button>
            ) : null}
            {phase === 'focus' ? (
              <button type="button" className="button" onClick={() => setPhase('pausing')}>
                暂停一下
              </button>
            ) : null}
            {phase === 'paused' ? (
              <button type="button" className="button" onClick={() => setPhase('resuming')}>
                继续学习
              </button>
            ) : null}
            {phase === 'focus' || phase === 'paused' ? (
              <button type="button" className="button button--secondary" onClick={completeSession}>
                演示：完成学习
              </button>
            ) : null}
            {phase === 'completed' ? (
              <button type="button" className="button" onClick={() => setPhase('reward')}>
                接过它的信封
              </button>
            ) : null}
          </div>

          <label className="companion-demo__toggle">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            减少动态效果
          </label>

          <div className="miko-motion-demo__recipe">
            <span>这个 Demo 实际用到</span>
            <strong>1 张 PNG 图集 · 5 个姿势 · 6 个过渡状态</strong>
            <small>双图层交叉过渡，使用 transform 和 opacity，不需要 Canvas 或骨骼。</small>
          </div>
        </aside>
      </div>
    </section>
  )
}
