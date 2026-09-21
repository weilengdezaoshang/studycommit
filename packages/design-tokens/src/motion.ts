export const motion = {
  disabledOpacity: 0.48,
  pressedOpacity: 0.72,
  durationFast: 150,
  durationNormal: 240,
  /** 内容级过渡(书本翻页等),两端共用慢速语义。 */
  durationSlow: 420,
  /** 拼图奖励：揭晓、停留、落点、飞入与布局稳定。 */
  puzzleReveal: 200,
  puzzleHold: 350,
  puzzleTarget: 150,
  puzzleFlight: 450,
  puzzleSettle: 240,
} as const
