import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const readJson = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'))
const app = readJson('app.json')

for (const page of app.pages) {
  for (const extension of ['.ts', '.wxml', '.wxss', '.json']) {
    const file = `${page}${extension}`
    if (!existsSync(resolve(root, file))) {
      throw new Error(`页面 ${page} 缺少文件 ${file}`)
    }
  }
}

for (const file of ['app.json', 'project.config.json', 'sitemap.json']) {
  readJson(file)
}

for (const file of [
  'app.ts',
  'app.wxss',
  'styles/tokens.wxss',
  'services/monitor-adapter.ts',
  'constants/app.ts',
  'constants/api.ts',
  'constants/events.ts',
  'constants/routes.ts',
]) {
  if (!existsSync(resolve(root, file))) {
    throw new Error(`工程缺少基础文件 ${file}`)
  }
}

console.log(`[miniprogram] 检查通过：${app.pages.length} 个页面`)
