/** R81/R95：只按位移提交，轻甩速度不能确认理解。 */
export const explanationThreshold = (width: number) => Math.max(64, Math.min(100, width * 0.24))

/** 上滑回看只依据距离，保持不同屏幕上的触发范围一致。 */
export const explanationHistoryThreshold = (height: number) =>
  Math.max(80, Math.min(120, height * 0.2))
