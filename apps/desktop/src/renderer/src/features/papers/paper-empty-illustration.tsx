/** 空态插画:软圆底上一叠散页,其中一张带黄色折角。纯 DOM 绘制,不依赖图片资源。 */
export function PaperEmptyIllustration({ size = 120 }: { size?: number }): React.JSX.Element {
  return (
    <div
      className="paper-empty-illustration"
      style={{ width: size, height: size * 0.8 }}
      aria-hidden
    >
      <span className="paper-empty-illustration__circle" />
      <span className="paper-empty-illustration__sheet paper-empty-illustration__sheet--back">
        <i />
        <i style={{ width: '60%' }} />
      </span>
      <span className="paper-empty-illustration__sheet paper-empty-illustration__sheet--front">
        <i className="paper-empty-illustration__fold" />
        <i style={{ width: '72%' }} />
        <i style={{ width: '52%' }} />
      </span>
      <span className="paper-empty-illustration__dot" />
    </div>
  )
}
