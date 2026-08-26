import { execFileSync } from 'node:child_process'
import { run } from './lib/command.mjs'

const suites = [
  { prefix: 'common/', command: ['pnpm', ['--filter', '@studycommit/common', 'test:run']] },
  { prefix: 'apps/api/', command: ['pnpm', ['--filter', '@studycommit/api', 'test:unit']] },
  { prefix: 'apps/desktop/', command: ['pnpm', ['--filter', '@studycommit/desktop', 'test']] },
  { prefix: 'apps/mobile/', command: ['pnpm', ['--filter', '@studycommit/mobile', 'test:run']] },
  {
    prefix: 'packages/design-tokens/',
    command: ['pnpm', ['--filter', '@studycommit/design-tokens', 'test:run']],
  },
]

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

const selected = suites.filter((suite) => staged.some((file) => file.startsWith(suite.prefix)))
if (selected.length === 0) {
  console.log('[pre-commit] 没有应用或共享包改动，跳过单元测试')
  process.exit(0)
}

for (const suite of selected) {
  console.log(`[pre-commit] 运行 ${suite.prefix} 单元测试`)
  run(suite.command[0], suite.command[1])
}
