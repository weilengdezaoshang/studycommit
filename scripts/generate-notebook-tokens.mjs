import { writeFileSync } from 'node:fs'
import { spacing } from '../packages/design-tokens/src/spacing.ts'
import { radii } from '../packages/design-tokens/src/radii.ts'
import { motion } from '../packages/design-tokens/src/motion.ts'
import { typography } from '../packages/design-tokens/src/typography.ts'
const values = {
  'space-sm': `${spacing.sm}px`,
  'space-md': `${spacing.md}px`,
  'space-lg': `${spacing.lg}px`,
  'radius-sm': `${radii.sm}px`,
  'radius-md': `${radii.md}px`,
  'radius-lg': `${radii.lg}px`,
  body: `${typography.body.fontSize}px`,
  disabled: motion.disabledOpacity,
  pressed: motion.pressedOpacity,
}
const css =
  '/* 由 scripts/generate-notebook-tokens.mjs 生成，请修改公共 design-tokens。 */\npage {\n' +
  Object.entries(values)
    .map(([key, value]) => `  --nb-${key}: ${value};`)
    .join('\n') +
  '\n}\n'
writeFileSync(new URL('../apps/miniprogram/styles/notebook-tokens.wxss', import.meta.url), css)
