export function ErrorFallback(): React.JSX.Element {
  return (
    <section className="placeholder" role="alert">
      <span className="placeholder__label">页面错误</span>
      <h2>这个页面暂时无法显示</h2>
      <p>应用导航仍然可用，你可以离开当前页面后重试。</p>
    </section>
  )
}
