import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
const require = createRequire(import.meta.url)
const tenTap = dirname(require.resolve('@10play/tentap-editor/package.json'))
export default defineConfig({
  root: import.meta.dirname,
  plugins: [viteSingleFile()],
  resolve: {
    alias: { '@10play/tentap-editor/web': resolve(tenTap, 'src/webEditorUtils/index.ts') },
    dedupe: ['react', 'react-dom', '@tiptap/core', '@tiptap/pm'],
  },
  build: { outDir: '.build', emptyOutDir: true, target: 'es2020' },
})
