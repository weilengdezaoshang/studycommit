import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import './notebook.css'
import { SketchBorder } from './SketchBorder'

/** 只负责纸面表现，不读取业务状态；标题、正文始终是原生可访问内容。 */
export function PaperPanel({
  title,
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { title?: string }) {
  return (
    <section {...props} className={`notebook-paper ${className}`}>
      <SketchBorder />
      {title && <h3 className="notebook-caption">{title}</h3>}
      {children}
    </section>
  )
}

export function NotebookButton({
  variant = 'secondary',
  sketch = false,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  sketch?: boolean
}) {
  return (
    <button
      {...props}
      type={type}
      className={`notebook-button notebook-button--${variant}${sketch ? ' notebook-button--sketch' : ''} ${className}`}
    >
      {sketch && <SketchBorder />}
      {children}
    </button>
  )
}

export function StateNotice({
  children,
  tone = 'error',
  actions,
}: {
  children: ReactNode
  tone?: 'error' | 'info' | 'warning'
  actions?: ReactNode
}) {
  return (
    <div
      className={`notebook-notice notebook-notice--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span aria-hidden="true">{tone === 'info' ? 'ⓘ' : '!'}</span>
      <div>{children}</div>
      {actions && <div className="notebook-notice__actions">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  children,
  error = false,
}: {
  title: string
  description: string
  children?: ReactNode
  error?: boolean
}) {
  return (
    <PaperPanel className={`notebook-empty${error ? ' notebook-empty--error' : ''}`}>
      <span className="notebook-empty__mark" aria-hidden="true">
        {error ? '!' : '…'}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="notebook-actions">{children}</div>
    </PaperPanel>
  )
}

export function LoadingState({ label = '正在加载记录…' }: { label?: string }) {
  return (
    <div className="notebook-loading" role="status" aria-busy="true">
      <p>{label}</p>
      <i />
      <i />
      <i />
    </div>
  )
}

export function LengthFeedback({
  value,
  limit,
  label,
  id,
}: {
  value: string
  limit: number
  label: string
  id?: string
}) {
  const count = value.trim().length
  const excess = count - limit
  return (
    <div
      id={id}
      className={`notebook-length${excess > 0 ? ' notebook-length--invalid' : ''}`}
      aria-live="polite"
    >
      <span>
        {excess > 0
          ? `${label}已超出 ${excess.toLocaleString()} 字，请精简后保存。`
          : count === limit
            ? `${label}已达到上限。`
            : `${label}最多 ${limit.toLocaleString()} 字`}
      </span>
      <span>
        {count.toLocaleString()} / {limit.toLocaleString()}
      </span>
    </div>
  )
}

export function QuestionBadge({ resolved = false }: { resolved?: boolean }) {
  return (
    <span className={`notebook-bubble${resolved ? ' notebook-bubble--resolved' : ''}`}>
      {resolved ? '✓ 已经解决' : '? 还在思考'}
    </span>
  )
}
