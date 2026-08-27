import { useState } from 'react'

type Paper = {
  id: string
  time: string
  summary: string
  text: string
  topic: string | null
  question: boolean
  sourceCode: string
  sourceText: string
  understanding: string
  relativeDay: string
  dateLabel: string
}

const papers: Paper[] = [
  {
    id: 'p-2',
    time: '14:20',
    relativeDay: '今天',
    dateLabel: '8 月 25 日',
    summary: '为什么 React 的状态更新不是立即生效？',
    text: '为什么 React 的状态更新不是立即生效？批处理和调度分别解决了什么问题？',
    topic: null,
    question: true,
    sourceCode: 'setNumber(number + 1);\nsetNumber(number + 1);\nsetNumber(number + 1);',
    sourceText: 'React waits until all code in the event handlers has run…',
    understanding:
      'React 会先等事件处理结束，再把这段时间发生的状态更新一起处理；但还没弄清调度何时介入。',
  },
  {
    id: 'p-1',
    time: '09:42',
    relativeDay: '昨天',
    dateLabel: '8 月 24 日',
    summary: 'Safe Area 到底约束了什么？',
    text: 'Safe Area 不只是顶部留白，它代表系统界面与应用内容之间需要共同遵守的边界。',
    topic: '移动端设计',
    question: true,
    sourceCode: 'safe-area-inset-top\nsafe-area-inset-bottom',
    sourceText: '系统界面和应用内容需要共同遵守的显示边界。',
    understanding: '安全区域不是固定留白，而是由设备形态和系统控件共同决定的可用内容边界。',
  },
  {
    id: 'p-3',
    time: '16:08',
    relativeDay: '周六',
    dateLabel: '8 月 22 日',
    summary: '闭包为什么记住旧变量？',
    text: '闭包会保留创建时的词法作用域，因此回调中可能读到当时捕获的旧变量。',
    topic: 'JavaScript',
    question: false,
    sourceCode: 'const value = count;\nreturn () => value;',
    sourceText: '回调保留了创建时可见的变量环境。',
    understanding: '闭包读取的是它建立时捕获的词法环境，而不是调用时同名变量的最新值。',
  },
]

const unresolvedCount = papers.filter((paper) => paper.question).length
const draftPapers = papers.filter((paper) => !paper.topic)

const topics = [
  { name: '移动端设计', count: 18, color: '#d6a33d' },
  { name: '工程实践', count: 12, color: '#7f9d89' },
  { name: 'TypeScript', count: 9, color: '#8c82aa' },
]

export function MockTodayPage(): React.JSX.Element {
  const [selected, setSelected] = useState('p-2')
  const selectedPaper = papers.find((paper) => paper.id === selected) ?? papers[0]
  return (
    <section className="desktop-home" aria-label="问题工作台">
      <aside className="record-index">
        <header>
          <strong>正在思考</strong>
          <span>{unresolvedCount} 个</span>
        </header>
        {papers.map((paper) => (
          <button
            key={paper.id}
            type="button"
            className={`record-row${selected === paper.id ? ' is-active' : ''}${paper.question ? '' : ' is-done'}`}
            aria-label={`${paper.summary}。${paper.text}`}
            onClick={() => setSelected(paper.id)}
          >
            <time>{paper.relativeDay}</time>
            <span>{paper.summary}</span>
            {paper.question ? <b aria-hidden="true">?</b> : null}
          </button>
        ))}
        <p className="record-index__foot">
          这里只放还值得继续的问题。月份、箱子和全部纸页都收在左上角的抽屉里。
        </p>
      </aside>
      <article className="record-reader">
        <header>
          <time>
            {selectedPaper.time} · {selectedPaper.relativeDay}
          </time>
          <button type="button" aria-label="更多操作">
            ···
          </button>
        </header>
        <div className="record-reader__body">
          <div className="record-reader__tag">
            {selectedPaper.question ? <b aria-hidden="true">?</b> : null}
            <span>
              {selectedPaper.topic ?? 'React'} · {selectedPaper.question ? '还在思考' : '已理解'}
            </span>
          </div>
          <h2>{selectedPaper.text}</h2>
          <div className="source-scrap">
            <code>{selectedPaper.sourceCode}</code>
            <div>
              <strong>当时截下来的线索</strong>
              <span>{selectedPaper.sourceText}</span>
            </div>
          </div>
          <div className="understanding">
            <span>我现在理解到</span>
            <p>{selectedPaper.understanding}</p>
          </div>
          <div className="record-reader__actions">
            <button type="button">先收起来</button>
            <button type="button" className="primary">
              继续把它弄懂
            </button>
          </div>
        </div>
        <footer>
          <span>{selectedPaper.dateLabel}</span>
          <span>STUDYCOMMIT</span>
        </footer>
      </article>
      <button type="button" className="capture-question">
        截取问题 <kbd>⌥ ⇧ Q</kbd>
      </button>
    </section>
  )
}

export function MockDraftsPage(): React.JSX.Element {
  return (
    <MockCollectionPage
      title="待整理"
      description="先留下，稍后再决定它应该放进哪个箱子。"
      label={`${draftPapers.length} 张纸页待整理`}
      papers={draftPapers}
      action="归入箱子"
    />
  )
}

export function MockTopicsPage(): React.JSX.Element {
  return (
    <section className="mock-page">
      <div className="mock-page__heading">
        <div>
          <h2>我的箱子</h2>
          <p>由你决定知识应该如何归档。</p>
        </div>
        <button type="button" className="button button--secondary">
          新建箱子
        </button>
      </div>
      <div className="mock-topic-grid">
        {topics.map((topic) => (
          <article className="topic-card" key={topic.name}>
            <span className="topic-card__dot" style={{ background: topic.color }} />
            <h3>{topic.name}</h3>
            <p>{topic.count} 张纸页</p>
            <button type="button" className="button button--quiet">
              打开箱子
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export function MockReviewPage(): React.JSX.Element {
  return (
    <MockCollectionPage
      title="还在思考"
      description="问题不会催促你，它只是把下一步学习留在这里。"
      label="2 个未解决问题"
      papers={papers.filter((paper) => paper.question)}
      action="继续理解"
    />
  )
}

function MockCollectionPage({
  title,
  description,
  label,
  papers: items,
  action,
}: {
  title: string
  description: string
  label: string
  papers: Paper[]
  action: string
}): React.JSX.Element {
  return (
    <section className="mock-page">
      <div className="mock-page__heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="mock-label">{label}</span>
      </div>
      <div className="mock-collection">
        {items.map((paper) => (
          <article className="paper-card paper-card--static" key={paper.id}>
            <span className="paper-card__time">{paper.time}</span>
            <p className="paper-card__body">{paper.text}</p>
            <span className="paper-card__meta">{paper.topic ?? '待整理'}</span>
            <button type="button" className="button button--quiet">
              {action}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
