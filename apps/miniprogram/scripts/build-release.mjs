import { buildSync } from 'esbuild'
import ts from 'typescript'
import { cpSync, readdirSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve, basename, relative, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

export function validateReleaseConfig(env) {
  if (!/^wx[0-9a-f]{16}$/.test(env.MINIPROGRAM_APP_ID ?? '')) {
    throw new Error('请配置有效的 MINIPROGRAM_APP_ID')
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(env.MINIPROGRAM_CLOUD_ENV ?? '')) {
    throw new Error('请配置 MINIPROGRAM_CLOUD_ENV，禁止发布时回退到默认环境')
  }
  return { appId: env.MINIPROGRAM_APP_ID, cloudEnv: env.MINIPROGRAM_CLOUD_ENV }
}

export function buildRelease(env = process.env) {
  const config = validateReleaseConfig(env)
  const root = resolve(import.meta.dirname, '..')
  // 每次创建独立目录，避免旧文件混入发布包，也不删除现有构建。
  const output = resolve(root, 'release-output', `${Date.now()}`)
  mkdirSync(output, { recursive: true })
  for (const entry of readdirSync(root)) {
    if (entry === 'release-output') {
      continue
    }
    cpSync(resolve(root, entry), resolve(output, entry), {
      recursive: true,
      filter: (source) => {
        const name = basename(source)
        return (
          ![
            'release-output',
            'node_modules',
            'scripts',
            'cloudfunctions',
            'pages/capture-design',
          ].includes(name) &&
          name !== 'capture-design' &&
          name !== 'project.private.config.json' &&
          !/\.(test|spec)\.[cm]?[jt]sx?$/.test(name) &&
          !/^(package|tsconfig|vitest)/.test(name)
        )
      },
    })
  }
  const app = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8'))
  app.pages = app.pages.filter((page) => !page.startsWith('pages/capture-design/'))
  writeFileSync(resolve(output, 'app.json'), JSON.stringify(app, null, 2))
  const project = JSON.parse(readFileSync(resolve(root, 'project.config.json'), 'utf8'))
  project.appid = config.appId
  delete project.cloudfunctionRoot
  writeFileSync(resolve(output, 'project.config.json'), JSON.stringify(project, null, 2))
  writeFileSync(
    resolve(output, 'constants/cloud.ts'),
    `export function getCloudEnvId(): string { return ${JSON.stringify(config.cloudEnv)} }\n`,
  )
  writeFileSync(
    resolve(output, 'constants/build.ts'),
    'export const DESIGN_PREVIEW_ENABLED = false\n',
  )
  compileRelease(output, root)
  console.log(`发布工程已生成：${output}。仍需开发者工具编译、真机验收后提审。`)
  return output
}

function compileRelease(output, root) {
  const modules = []
  const packages = new Map()
  for (const file of readdirSync(output, { recursive: true })) {
    if (!file.endsWith('.ts')) {
      continue
    }
    const source = resolve(output, file)
    if (file.endsWith('.d.ts')) {
      unlinkSync(source)
      continue
    }
    let code = ts.transpileModule(readFileSync(source, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText
    for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
      if (!match[1].startsWith('.')) {
        packages.set(match[1], packages.get(match[1]) ?? `module${packages.size}`)
      }
    }
    modules.push({ source, target: source.replace(/\.ts$/, '.js'), code })
  }
  const vendor = resolve(output, 'shared/vendor.js')
  buildSync({
    stdin: {
      contents: [...packages]
        .map(([name, alias]) => `export * as ${alias} from ${JSON.stringify(name)}`)
        .join('\n'),
      resolveDir: root,
    },
    bundle: true,
    alias: { '@studycommit/rpc-contracts': resolve(root, '../../packages/rpc-contracts/src') },
    platform: 'browser',
    format: 'cjs',
    target: 'es2020',
    minify: true,
    outfile: vendor,
  })
  for (const module of modules) {
    let vendorPath = relative(dirname(module.target), vendor).split('\\').join('/')
    if (!vendorPath.startsWith('.')) {
      vendorPath = `./${vendorPath}`
    }
    const code = module.code.replace(/require\(["']([^"']+)["']\)/g, (original, name) =>
      packages.has(name)
        ? `require(${JSON.stringify(vendorPath)}).${packages.get(name)}`
        : original,
    )
    writeFileSync(module.target, code)
    unlinkSync(module.source)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildRelease()
}
