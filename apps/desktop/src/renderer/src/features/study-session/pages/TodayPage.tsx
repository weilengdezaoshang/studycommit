import { useState } from 'react'
import { StartStudyPanel } from '../components/StartStudyPanel'
import { SessionPanel } from '../components/SessionPanel'
import type { StudySessionController } from '@studycommit/common/study-session-react'

export function TodayPage({ study }: { study: StudySessionController }): React.JSX.Element {
  const [starting, setStarting] = useState(false)
  if ((study.phase === 'active' || study.phase === 'completed') && starting) {
    setStarting(false)
  }

  if (study.phase === 'loading') {
    return (
      <section className="study-page" aria-busy="true">
        <p>正在读取当前学习会话</p>
      </section>
    )
  }

  if (study.phase === 'error') {
    return (
      <section className="study-page" role="alert">
        <h2>无法读取当前学习</h2>
        <p>{study.error?.message}</p>
        {study.error?.requestId ? <p className="study-meta">请求 {study.error.requestId}</p> : null}
        <button type="button" className="button" onClick={study.reload}>
          重试
        </button>
      </section>
    )
  }

  if ((study.phase === 'active' || study.phase === 'completed') && study.session) {
    return (
      <SessionPanel
        session={study.session}
        serverNow={study.serverNow}
        topicName={study.topicName}
        pendingCommand={study.pendingCommand}
        confirmingRemote={study.confirmingRemote}
        onPause={study.pause}
        onResume={study.resume}
        onComplete={study.complete}
        onBackToStart={study.reload}
      />
    )
  }

  if (starting) {
    return <StartStudyPanel onCancel={() => setStarting(false)} study={study} />
  }

  return (
    <section className="study-page">
      <article className="study-card">
        <h2>当前学习</h2>
        <p className="study-card__title">今天，从一次专注开始</p>
        <p className="study-card__goal">选择专题后开始学习。关闭应用不会结束进行中的会话。</p>
        <button type="button" className="button" onClick={() => setStarting(true)}>
          开始学习
        </button>
      </article>
    </section>
  )
}
