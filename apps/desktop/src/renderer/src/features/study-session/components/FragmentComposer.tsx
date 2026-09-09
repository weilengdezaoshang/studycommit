import { useCallback, useEffect, useState } from 'react'
import type { PaperFragment } from '@studycommit/common/contracts'
import { PAPER_QUESTION_MAX_LENGTH } from '@studycommit/common/paper-runtime'
import { useDesktopServices } from '../api/DesktopServicesProvider'

/**
 * 片段写入(DE-313):会话期间"记下一点",Enter 即存;
 * 离线时主进程落盘排队,联网后自动重放(本地不丢)。
 */
export function FragmentComposer({ sessionId }: { sessionId: string }): React.JSX.Element {
  const { studySessions } = useDesktopServices()
  const [items, setItems] = useState<PaperFragment[] | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(() => {
    void studySessions
      .listFragments(sessionId)
      .then((items) => setItems(items))
      .catch(() => setItems(null))
  }, [sessionId, studySessions])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    const content = value.trim()
    if (!content || busy) {
      return
    }
    setBusy(true)
    setNote(null)
    try {
      await studySessions.createFragment({
        sessionId,
        fragmentId: crypto.randomUUID(),
        content,
        idempotencyKey: crypto.randomUUID(),
      })
      setValue('')
      setNote(null)
      load()
    } catch {
      setNote('暂时离线：已存入本机队列，联网后自动同步')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="study-log" data-testid="fragment-composer">
      <div className="study-form__actions" style={{ marginBottom: 8 }}>
        <input
          aria-label="记下一点"
          value={value}
          maxLength={PAPER_QUESTION_MAX_LENGTH}
          placeholder="记下一点…（Enter 保存）"
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void submit()
            }
          }}
          style={{ flex: 1, minHeight: 36 }}
        />
        <button
          type="button"
          className="button button--secondary"
          disabled={busy || !value.trim()}
          onClick={() => void submit()}
        >
          记下
        </button>
      </div>
      {note ? (
        <p role="status" style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.75 }}>
          {note}
        </p>
      ) : null}
      {items && items.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          {items.map((item) => (
            <li key={item.id} style={{ fontSize: 13 }}>
              {item.content}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
