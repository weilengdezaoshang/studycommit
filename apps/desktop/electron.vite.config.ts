import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    envPrefix: ['MAIN_VITE_', 'VITE_', 'STUDYCOMMIT_'],
    plugins: [externalizeDepsPlugin({ exclude: ['@studycommit/common'] })],
  },
  preload: { plugins: [externalizeDepsPlugin({ exclude: ['@studycommit/common'] })] },
  renderer: {
    resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
    plugins: [react()],
  },
})
