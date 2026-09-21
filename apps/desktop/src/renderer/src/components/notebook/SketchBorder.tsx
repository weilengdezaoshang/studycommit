import { useEffect, useRef } from 'react'
import rough from 'roughjs'

/** 独立装饰层：只测量自己的尺寸，不承载文字、事件或业务状态。 */
export function SketchBorder() {
  const element = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = element.current
    if (!svg) {
      return
    }
    const draw = () => {
      const { width, height } = svg.getBoundingClientRect()
      if (!width || !height) {
        return
      }
      const border = rough.svg(svg).rectangle(3, 3, width - 6, height - 6, {
        seed: 41,
        roughness: 1.6,
        bowing: 1.8,
        stroke: 'currentColor',
        strokeWidth: 1.3,
        fill: 'none',
        disableMultiStroke: false,
      })
      svg.replaceChildren(border)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])
  return (
    <svg ref={element} className="notebook-sketch-border" aria-hidden="true" focusable="false" />
  )
}
