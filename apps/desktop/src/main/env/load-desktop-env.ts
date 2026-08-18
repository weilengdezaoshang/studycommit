import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadDesktopEnvFile(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const merged: NodeJS.ProcessEnv = { ...env }
  const files = [resolve(process.cwd(), '.env'), resolve(__dirname, '../../.env')]
  for (const file of files) {
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) {
        continue
      }
      const separator = line.indexOf('=')
      if (separator <= 0) {
        continue
      }
      const key = line.slice(0, separator).trim()
      if (merged[key] !== undefined) {
        continue
      }
      merged[key] = unquote(line.slice(separator + 1).trim())
    }
  }
  return merged
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}
