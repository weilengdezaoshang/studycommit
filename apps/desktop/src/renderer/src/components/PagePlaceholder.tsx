interface PagePlaceholderProps {
  title: string
  description: string
  nextTask: string
}

export function PagePlaceholder({
  title,
  description,
  nextTask,
}: PagePlaceholderProps): React.JSX.Element {
  return (
    <section className="placeholder" aria-labelledby="placeholder-title">
      <span className="placeholder__label">{nextTask}</span>
      <h2 id="placeholder-title">{title}</h2>
      <p>{description}</p>
    </section>
  )
}
