import {
  Children,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { SketchBorder } from '../notebook/SketchBorder'
import { getMenuPosition } from './menu-position'
import './dropdown-select.css'
import '../notebook/notebook.css'

export type DropdownSelectProps = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'id'
  | 'disabled'
  | 'className'
  | 'aria-label'
  | 'aria-describedby'
  | 'aria-labelledby'
  | 'onBlur'
  | 'onFocus'
> & {
  value?: string | number
  onValueChange?: (value: string) => void
  children: ReactNode
  name?: string
  required?: boolean
}
type Option = { value: string; label: string; disabled: boolean }

/** 所有桌面单选下拉共用：焦点留在触发器，菜单通过 aria-activedescendant 导航。 */
export function DropdownSelect({
  value = '',
  onValueChange,
  children,
  className = '',
  name,
  required,
  disabled,
  ...props
}: DropdownSelectProps) {
  const generatedId = useId()
  const id = props.id ?? generatedId
  const menuId = `${id}-menu`
  const options: Option[] = Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)
    ) {
return []
}
    return [
      {
        value: String(child.props.value ?? ''),
        label: Children.toArray(child.props.children).join(''),
        disabled: Boolean(child.props.disabled),
      },
    ]
  })
  const selected = options.findIndex((option) => option.value === String(value))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState<ReturnType<typeof getMenuPosition> | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuContent = useRef<HTMLDivElement>(null)
  const search = useRef({ text: '', time: 0 })
  const visible = open && !disabled
  if (disabled && open) {
    setOpen(false)
  }
  const show = () => {
    setActive(
      selected >= 0 && !options[selected].disabled
        ? selected
        : Math.max(
            0,
            options.findIndex((option) => !option.disabled),
          ),
    )
    setOpen(true)
  }
  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) {
return
}
    setOpen(false)
    onValueChange?.(option.value)
  }
  useLayoutEffect(() => {
    if (!visible) {
return
}
    const update = () => {
      if (!trigger.current) {
return
}
      setPosition(
        getMenuPosition(
          trigger.current.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight },
          menuContent.current?.scrollHeight || Math.max(44, options.length * 40 + 12),
        ),
      )
    }
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !menu.current?.contains(event.target)
      ) {
setOpen(false)
}
    }
    const observer = new ResizeObserver(update)
    if (trigger.current) {
observer.observe(trigger.current)
}
    if (menuContent.current) {
observer.observe(menuContent.current)
}
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    document.addEventListener('pointerdown', outside, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('pointerdown', outside, true)
    }
  }, [visible, options.length, Boolean(position)])
  useLayoutEffect(() => {
    if (visible) {
document.getElementById(`${menuId}-${active}`)?.scrollIntoView?.({ block: 'nearest' })
}
  }, [active, visible, menuId, Boolean(position)])
  return (
    <span className="notebook-select">
      <SketchBorder />
      <button
        {...props}
        id={id}
        ref={trigger}
        type="button"
        role="combobox"
        disabled={disabled}
        className={`notebook-select__control ${className}`}
        aria-haspopup="listbox"
        aria-expanded={visible}
        aria-controls={visible ? menuId : undefined}
        aria-activedescendant={visible && options[active] ? `${menuId}-${active}` : undefined}
        aria-required={required}
        onClick={() => (visible ? setOpen(false) : show())}
        onBlur={(event) => {
          setOpen(false)
          props.onBlur?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && visible) {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
            return
          }
          if (event.key === 'Tab') {
            setOpen(false)
            return
          }
          if (['Enter', ' '].includes(event.key)) {
            event.preventDefault()
            if (visible) {
choose(active)
} else {
show()
}
            return
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            if (!visible) {
              show()
              return
            }
            const enabled = options.flatMap((option, index) => (option.disabled ? [] : [index]))
            if (!enabled.length) {
return
}
            const index = enabled.indexOf(active)
            setActive(
              event.key === 'Home'
                ? enabled[0]
                : event.key === 'End'
                  ? enabled[enabled.length - 1]
                  : enabled[
                      (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) %
                        enabled.length
                    ],
            )
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const now = Date.now()
            search.current = {
              text:
                (now - search.current.time > 700 ? '' : search.current.text) +
                event.key.toLowerCase(),
              time: now,
            }
            const found = options.findIndex(
              (option) =>
                !option.disabled && option.label.toLowerCase().startsWith(search.current.text),
            )
            if (found >= 0) {
              setActive(found)
              setOpen(true)
            }
          }
        }}
      >
        <span className="dropdown-select__value">{options[selected]?.label ?? '请选择'}</span>
      </button>
      <svg className="notebook-select__arrow" viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M5 7.5 10 12.5 15 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      {visible &&
        position &&
        createPortal(
          <div
            ref={menu}
            className="dropdown-select-menu"
            style={{ left: position.left, top: position.top, width: position.width }}
            data-placement={position.placement}
            onMouseDown={(event) => event.preventDefault()}
          >
            <SketchBorder />
            <div
              ref={menuContent}
              id={menuId}
              role="listbox"
              aria-labelledby={id}
              className="dropdown-select-menu__options"
              style={{ maxHeight: position.maxHeight }}
            >
              {options.length ? (
                options.map((option, index) => (
                  <div
                    key={option.value}
                    id={`${menuId}-${index}`}
                    role="option"
                    aria-selected={selected === index}
                    aria-disabled={option.disabled || undefined}
                    className={`dropdown-select-option${active === index ? ' is-active' : ''}`}
                    onPointerMove={() => {
                      if (!option.disabled) {
setActive(index)
}
                    }}
                    onClick={() => choose(index)}
                  >
                    <span>{option.label}</span>
                    <span aria-hidden="true">{selected === index ? '✓' : ''}</span>
                  </div>
                ))
              ) : (
                <div className="dropdown-select-empty">暂无可选项</div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}
