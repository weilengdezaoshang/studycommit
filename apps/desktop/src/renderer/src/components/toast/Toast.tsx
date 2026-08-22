export function Toast({
  message,
  onClose,
  type: _type,
}: {
  message: string | null
  onClose: () => void
  type?: 'default' | 'error'
}): React.JSX.Element | null {
  if (!message) {
    return null
  }
  return (
    <div className="toast" role="status">
      <button type="button" className="toast__message" onClick={onClose}>
        {message}
      </button>
    </div>
  )
}
