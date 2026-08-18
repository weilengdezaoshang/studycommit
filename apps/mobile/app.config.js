/* eslint-disable @typescript-eslint/no-require-imports -- Expo app.config 由 Node 以 CommonJS 加载 */
const fs = require('node:fs')
const path = require('node:path')

function loadEnvFile(file) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return
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
    if (process.env[key] !== undefined) {
      continue
    }
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile(path.join(__dirname, '.env'))

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    studycommitApiOrigin: process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN,
    studycommitApiPrefix: process.env.EXPO_PUBLIC_STUDYCOMMIT_API_PREFIX || '/api',
    studycommitDevUserId:
      process.env.NODE_ENV === 'production' ? undefined : process.env.STUDYCOMMIT_DEV_USER_ID,
  },
})
