const { app, nativeImage } = require('electron')
const { createWorker } = require('tesseract.js')
const { resolve } = require('node:path')
const { readFileSync } = require('node:fs')
const { transpileModule, ModuleKind } = require('typescript')

app
  .whenReady()
  .then(async () => {
    const source = nativeImage.createFromPath(process.argv[2])
    const compiled = transpileModule(
      readFileSync(resolve(__dirname, '../src/main/capture/ocr-image.ts'), 'utf8'),
      { compilerOptions: { module: ModuleKind.CommonJS } },
    )
    const implementation = {}
    new Function('require', 'exports', compiled.outputText)(require, implementation)
    const worker = await createWorker('chi_sim+eng', 1, {
      langPath: resolve(__dirname, '../resources/ocr-models'),
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
    console.error(error.message)
    app.exit(1)
  })
