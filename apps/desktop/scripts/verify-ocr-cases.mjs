import { app, BrowserWindow, nativeImage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker } from 'tesseract.js'
import { ModuleKind, transpileModule } from 'typescript'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const nodeRequire = createRequire(import.meta.url)

const chinese = [
  '启动桌面端和移动端',
  '新增移动端拍照记录功能',
  '评估后端架构与并发方案',
  '修复草稿记录无入口问题',
]
const cases = [
  { name: '中文列表正常留白', lines: chinese },
  { name: '中文列表紧贴上边缘', lines: chinese, top: 0 },
  {
    name: '中英混排',
    lines: ['使用 React 19 构建桌面应用', '调用 API 保存截图记录', 'HTTP 200 表示请求成功'],
  },
  {
    name: '英文段落',
    lines: [
      'Save screenshots and notes together.',
      'Retry the upload when the network returns.',
      'Keep your original image unchanged.',
    ],
  },
  {
    name: '代码与标点',
    lines: ['const count = 42;', 'if (count > 0) {', '  console.log("Hello, world!");', '}'],
    font: 'Menlo',
    size: 20,
  },
  { name: '小字号中文12像素', lines: chinese, size: 12, lineHeight: 24 },
  { name: '深色背景', lines: chinese, background: '#20242b', color: '#f2f4f8' },
  { name: '低对比度灰字', lines: chinese, background: '#f4f4f4', color: '#999999' },
  {
    name: '数字与符号',
    lines: ['2026-09-16 15:30', 'Price: $19.99 / 50%', 'Version: v1.2.3 (stable)'],
  },
  {
    name: '双栏文本',
    lines: ['第一栏学习记录', '截图内容自动识别'],
    right: ['第二栏待办事项', '保存图片和文字'],
  },
  { name: '空白图片', lines: [] },
]

function normalize(text) {
  return text.replace(/\s/g, '')
}
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1]
    for (let j = 0; j < b.length; j++) {
      next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)))
    }
    row = next
  }
  return row[b.length]
}

app
  .whenReady()
  .then(async () => {
    const output = resolve(scriptDir, '../../../docs/design/ocr-regression-2026-09-16')
    mkdirSync(output, { recursive: true })
    const compiled = transpileModule(
      readFileSync(resolve(scriptDir, '../src/main/capture/ocr-image.ts'), 'utf8'),
      { compilerOptions: { module: ModuleKind.CommonJS } },
    )
    const implementation = {}
    new Function('require', 'exports', compiled.outputText)(nodeRequire, implementation)
    const window = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true },
    })
    await window.loadURL('data:text/html,<html><body></body></html>')
    const worker = await createWorker('chi_sim+eng', 1, {
      langPath: resolve(scriptDir, '../resources/ocr-models'),
      gzip: false,
      cacheMethod: 'none',
    })
    const results = []
    try {
      if (process.argv[2]) {
        cases.unshift({ name: '用户实际贴边截图', lines: chinese, file: process.argv[2] })
      }
      for (let index = 0; index < cases.length; index++) {
        const sample = cases[index]
        let bytes
        if (sample.file) {
          bytes = readFileSync(sample.file)
        } else {
          const data = await window.webContents.executeJavaScript(
            `(${((sample) => {
              const canvas = document.createElement('canvas')
              canvas.width = 760
              canvas.height = 280
              const context = canvas.getContext('2d')
              context.fillStyle = sample.background || '#ffffff'
              context.fillRect(0, 0, canvas.width, canvas.height)
              context.fillStyle = sample.color || '#303030'
              context.font = `${sample.size || 22}px "${sample.font || 'PingFang SC'}"`
              context.textBaseline = 'top'
              sample.lines.forEach((text, i) =>
                context.fillText(text, 24, (sample.top ?? 24) + i * (sample.lineHeight || 46)),
              )
              sample.right?.forEach((text, i) => context.fillText(text, 390, 24 + i * 46))
              return canvas.toDataURL('image/png')
            }).toString()})(${JSON.stringify(sample)})`,
          )
          bytes = nativeImage.createFromDataURL(data).toPNG()
        }
        writeFileSync(join(output, `${index + 1}.png`), bytes)
        const reference = sample.lines.concat(sample.right || []).join('\n')
        const expected = normalize(reference)
        const result = {
          name: sample.name,
          reference,
          note: sample.right
            ? '按左栏后右栏评价阅读顺序'
            : sample.file
              ? '只评价完整可见四行；底部残缺文字不计入参考'
              : '',
          variants: {},
        }
        for (const [name, image] of [
          ['original', bytes],
          ['padded', implementation.prepareOcrImage(bytes)],
        ]) {
          const started = Date.now()
          const { data } = await worker.recognize(image)
          const errors = distance(expected, normalize(data.text))
          result.variants[name] = {
            text: data.text.trim(),
            confidence: data.confidence,
            errors,
            referenceCharacters: expected.length,
            milliseconds: Date.now() - started,
          }
        }
        results.push(result)
        console.log(
          `${sample.name}: 字符编辑距离 ${result.variants.original.errors} → ${result.variants.padded.errors}`,
        )
      }
      writeFileSync(join(output, 'results.json'), JSON.stringify(results, null, 2))
      console.log(`结果已保存：${output}`)
    } finally {
      await worker.terminate()
      window.destroy()
      app.quit()
    }
  })
  .catch((error) => {
    console.error(error.message)
    app.exit(1)
  })
