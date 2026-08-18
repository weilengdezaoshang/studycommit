export function SessionTimer({ value }: { value: string }): React.JSX.Element {
  return (
    <p className="session-timer" aria-hidden="true">
      {value}
    </p>
  )
}
