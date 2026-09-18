import { defineConfig } from '@umijs/max'
import path from 'node:path'
import { proxy } from './proxy'
import { routes } from './routes'

const designTokensSrc = path.resolve(__dirname, '../../../packages/design-tokens/src')

export default defineConfig({
  antd: {
    configProvider: {
      button: { autoInsertSpace: false },
    },
    appConfig: {},
  },
  access: {},
  model: {},
  initialState: {},
  layout: {
    title: 'StudyCommit 运营管理',
  },
  routes,
  proxy,
  npmClient: 'pnpm',
  mfsu: false,
  mock: false,
  title: 'StudyCommit 运营管理',
  alias: {
    '@studycommit/design-tokens': designTokensSrc,
  },
  extraBabelIncludes: [designTokensSrc],
  esbuildMinifyIIFE: true,
})
