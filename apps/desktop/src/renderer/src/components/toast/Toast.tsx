export function Toast({
  message,
  onClose,
}: {
  message: string | null
  onClose: () => void
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
