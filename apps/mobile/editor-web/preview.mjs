import { build } from 'vite'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = await mkdtemp(join(tmpdir(), 'studycommit-editor-preview-'))
await build({
  configFile: fileURLToPath(new URL('./vite.config.mjs', import.meta.url)),
  mode: 'browser-preview',
  build: { outDir: output, target: 'esnext' },
})
const html = await readFile(join(output, 'index.html'))
const server = createServer((_request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(html)
})
server.listen(4173, '127.0.0.1', () => console.log('编辑器网页预览：http://127.0.0.1:4173'))
const stop = () =>
  server.close(() => {
    void rm(output, { recursive: true, force: true }).then(() => process.exit(0))
  })
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
