import background from './assets/companion-anime-background.webp'
import companion from './assets/companion-anime-writing.webp'

type SceneState = 'ready' | 'focusing' | 'paused' | 'completed'

const sceneCopy: Record<SceneState, { title: string; detail: string }> = {
  ready: { title: '你的学习搭子已经就位', detail: '选好今天要推进的内容，我们就一起开始。' },
  focusing: { title: '正在和你一起专注', detail: '不用回应，也不用打卡。安静做完这一小段就好。' },
  paused: { title: '先停一停也没关系', detail: '场景会在这里等你，准备好时再继续。' },
  completed: {
    title: '今天的进度已经留下',
    detail: '这次学习会进入记录，也会慢慢填满你的成长书桌。',
  },
}

export function StudyCompanionScene({ state }: { state: SceneState }): React.JSX.Element {
  const copy = sceneCopy[state]
  return (
    <figure className={`study-companion-scene study-companion-scene--${state}`}>
      <img className="study-companion-scene__background" src={background} alt="" />
      <img className="study-companion-scene__person" src={companion} alt="安静写字的陪学伙伴" />
      <div className="study-companion-scene__shade" aria-hidden="true" />
      <figcaption className="study-companion-scene__caption" aria-live="polite">
        <span className="study-companion-scene__presence" aria-hidden="true" />
        <div>
          <strong>{copy.title}</strong>
          <span>{copy.detail}</span>
        </div>
      </figcaption>
    </figure>
  )
}
