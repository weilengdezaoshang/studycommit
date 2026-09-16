import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(new URL('../apps/miniprogram/package.json', import.meta.url))
const ts = require('typescript')
// 小程序公共运行层：无平台依赖，可安全编译进小程序包。
const modules = [
  {
    name: '图片状态模块',
    src: '../common/src/capture-runtime/index.ts',
    out: '../apps/miniprogram/shared/capture-runtime',
  },
  {
    name: '服务调用运行层',
    src: '../common/src/service-runtime/index.ts',
    out: '../apps/miniprogram/shared/service-runtime',
  },
]
let failed = false
for (const module of modules) {
  const source = fileURLToPath(new URL(module.src, import.meta.url))
  const outDir = fileURLToPath(new URL(module.out, import.meta.url))
  const program = ts.createProgram([source], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    declaration: true,
    skipLibCheck: true,
    outDir,
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  if (diagnostics.length) {
    failed = true
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => process.cwd(),
        getCanonicalFileName: (file) => file,
        getNewLine: () => '\n',
      }),
    )
  }
  const result = program.emit()
  if (result.emitSkipped) {
    failed = true
    throw new Error(`小程序${module.name}编译失败`)
  }
  console.log(`已从 common 生成小程序${module.name}`)
}
if (failed) {
  process.exitCode = 1
}
