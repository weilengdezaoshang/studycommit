import { useId } from 'react'
import { DropdownSelect, type DropdownSelectProps } from './DropdownSelect'
import '../notebook/notebook.css'

export function Select({
  children,
  hint,
  label,
  placeholder,
  ...props
}: DropdownSelectProps & {
  hint?: string
  label: string
  placeholder?: string
}): React.JSX.Element {
  const generatedId = useId()
  const fieldId = props.id ?? generatedId
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <DropdownSelect {...props} id={fieldId} aria-label={label}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children}
      </DropdownSelect>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}
