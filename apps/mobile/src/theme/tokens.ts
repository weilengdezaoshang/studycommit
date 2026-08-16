import { sizes as sharedSizes } from '@studycommit/design-tokens'

export {
  darkColors,
  lightColors,
  motion,
  radii,
  spacing,
  typography,
} from '@studycommit/design-tokens'

// 触控目标、控件高度和内容宽度属于移动端交互约束，不是跨端 Token。
export const sizes = {
  ...sharedSizes,
  touchTarget: 48,
  controlHeight: 48,
  contentMaxWidth: 640,
} as const
