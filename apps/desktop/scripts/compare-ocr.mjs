import { app, nativeImage } from 'electron'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker } from 'tesseract.js'
import { ModuleKind, transpileModule } from 'typescript'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const nodeRequire = createRequire(import.meta.url)

app
  .whenReady()
  .then(async () => {
    const source = nativeImage.createFromPath(process.argv[2])
    const compiled = transpileModule(
      readFileSync(resolve(scriptDir, '../src/main/capture/ocr-image.ts'), 'utf8'),
      { compilerOptions: { module: ModuleKind.CommonJS } },
    )
    const implementation = {}
    new Function('require', 'exports', compiled.outputText)(nodeRequire, implementation)
    const worker = await createWorker('chi_sim+eng', 1, {
      langPath: resolve(scriptDir, '../resources/ocr-models'),
      gzip: false,
      cacheMethod: 'none',
    })
    try {
      for (const [variant, bytes] of [
        ['original', source.toPNG()],
        ['padded', implementation.prepareOcrImage(source.toPNG())],
      ]) {
        const result = await worker.recognize(bytes)
        console.log(
          JSON.stringify({ variant, text: result.data.text, confidence: result.data.confidence }),
        )
      }
    } finally {
      await worker.terminate()
      app.quit()
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    app.exit(1)
  })
