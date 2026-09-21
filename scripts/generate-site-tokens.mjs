import { writeFileSync } from 'node:fs'
import { studyCommitMistBlueColors, lightColors } from '../packages/design-tokens/src/colors.ts'
import { spacing } from '../packages/design-tokens/src/spacing.ts'
import { radii } from '../packages/design-tokens/src/radii.ts'
import { motion } from '../packages/design-tokens/src/motion.ts'
import { typography } from '../packages/design-tokens/src/typography.ts'

const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
const declarations = []
const add = (name, value) => declarations.push(`  --${name}: ${value};`)
Object.entries(studyCommitMistBlueColors).forEach(([key, value]) => add(kebab(key), value))
for (const key of ['warning', 'warningSurface', 'success', 'successSurface']) {
  add(kebab(key), lightColors[key])
}
Object.entries(spacing).forEach(([key, value]) => add(`space-${kebab(key)}`, `${value}px`))
Object.entries(radii).forEach(([key, value]) => add(`radius-${key}`, `${value}px`))
for (const key of ['durationFast', 'durationNormal', 'durationSlow']) {
  add(kebab(key), `${motion[key]}ms`)
}
Object.entries(typography).forEach(([key, value]) => {
  add(`font-${kebab(key)}`, `${value.fontSize}px`)
  add(`leading-${kebab(key)}`, `${value.lineHeight}px`)
})
writeFileSync(
  new URL('../docs/site/tokens.css', import.meta.url),
  `/* Generated from packages/design-tokens. Run: node scripts/generate-site-tokens.mjs */\n:root {\n${declarations.join('\n')}\n}\n`,
)
