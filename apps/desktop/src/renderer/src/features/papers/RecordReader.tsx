import { Link } from 'react-router'
import { PaperPanel } from '../../components/notebook/Notebook'
import { PaperKnowledgeSection } from './PaperKnowledgeSection'
import { RecordActions } from './RecordActions'
import { RecordAssets } from './RecordAssets'
import { RichTextReader } from './RichTextEditor'
import { isOpenQuestion, type PaperWithExtra } from './view-model'
import type { DesktopTopic } from './papers-store'
import { routes } from '../../app/routes'
import './record-reader.css'

export function RecordReader({
  paper,
  topicName,
  topics,
  headingRef,
  closeButtonRef,
  onClose,
  onNotice,
  fullPage = false,
}: {
  paper: PaperWithExtra
  topicName: string
  topics: DesktopTopic[]
  headingRef?: React.Ref<HTMLHeadingElement>
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  onNotice: (message: string) => void
  fullPage?: boolean
}) {
  return (
    <article className="record-reader comic-reader" aria-label="阅读与思考">
      <header className="record-reader__bar">
        <h2 ref={headingRef} tabIndex={-1}>
          记录详情
        </h2>
        {!fullPage && (
          <>
            <Link to={routes.paper(paper.id)}>展开阅读 ↗</Link>
            <button ref={closeButtonRef} aria-label="关闭阅读栏" onClick={onClose}>
              ×
            </button>
          </>
        )}
      </header>
      <div className="comic-reader__layout">
        <div className="comic-reader__content">
          <PaperPanel title="当时记下">
            <p className="record-reader__meta">
              {new Date(paper.createdAt).toLocaleString('zh-CN', {
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · {topicName}
            </p>
            <RichTextReader content={paper.content} document={paper.contentDocument} />
            <RecordAssets assets={paper.assets} />
            {paper.questionText && (
              <div className="reader-question">
                <strong>{isOpenQuestion(paper) ? '? 还在思考' : '✓ 已解决'}</strong>
                <p>{paper.questionText}</p>
              </div>
            )}
          </PaperPanel>
          <PaperPanel title="我的理解">
            <PaperKnowledgeSection
              paperId={paper.id}
              content={paper.content}
              understanding={paper.understandingText}
            />
          </PaperPanel>
        </div>
        <RecordActions paper={paper} topics={topics} onNotice={onNotice} />
      </div>
    </article>
  )
}
