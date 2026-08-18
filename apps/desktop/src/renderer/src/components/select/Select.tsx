import type { ReactNode, SelectHTMLAttributes } from 'react'

export function Select({
  children,
  hint,
  label,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode
  hint?: string
  label: string
  placeholder?: string
}): React.JSX.Element {
  const fieldId = props.id ?? props.name ?? 'select'
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <select id={fieldId} {...props}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children}
      </select>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}
