import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { commandExists, run } from './command.mjs'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const log = (message) => console.log(`\n[StudyCommit] ${message}`)
export const fail = (message) => {
  throw new Error(message)
}

export function loadEnvFile(baseEnv = process.env) {
  const envPath = resolve(projectRoot, '.env')
  if (!existsSync(envPath)) {
    copyFileSync(resolve(projectRoot, '.env.example'), envPath)
    log('已根据 .env.example 创建 .env')
  }
  const env = { ...baseEnv }
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (match && env[match[1]] === undefined) {
      env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return env
}

export function portIsOpen(host, port, timeout = 500) {
  return new Promise((resolveResult) => {
    const socket = createConnection({ host, port })
    const done = (result) => {
      socket.destroy()
      resolveResult(result)
    }
    socket.setTimeout(timeout)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

export async function proxyEnv() {
  const env = { ...process.env }
  if (env.HTTPS_PROXY || env.https_proxy) {
    return env
  }
  if (process.platform === 'darwin' && (await portIsOpen('127.0.0.1', 7890))) {
    Object.assign(env, {
      http_proxy: 'http://127.0.0.1:7890',
      https_proxy: 'http://127.0.0.1:7890',
      HTTP_PROXY: 'http://127.0.0.1:7890',
      HTTPS_PROXY: 'http://127.0.0.1:7890',
      GODEBUG: 'http2client=0',
    })
    log('检测到本机 7890 代理，已用于容器运行环境下载')
  }
  return env
}

export function dockerReady(env = process.env) {
  return (
    commandExists('docker') && run('docker', ['info'], { quiet: true, allowFailure: true, env })
  )
}

export async function ensureDocker(env) {
  if (dockerReady(env)) {
    return
  }
  if (process.platform === 'darwin' && commandExists('colima')) {
    log('Docker Engine 未运行，正在自动启动 Colima')
    const args = ['start', '--cpu', '2', '--memory', '4', '--disk', '20']
    const proxy = env.HTTPS_PROXY ?? env.https_proxy
    if (proxy) {
      args.push(
        '--env',
        `HTTP_PROXY=${proxy}`,
        '--env',
        `HTTPS_PROXY=${proxy}`,
        '--env',
        'NO_PROXY=localhost,127.0.0.1,::1',
      )
    }
    run('colima', args, { env })
  } else if (process.platform === 'win32') {
    fail('Docker Desktop 尚未运行。请启动 Docker Desktop，等待 Engine Ready 后重试。')
  } else {
    fail('Docker Engine 尚未运行，请先启动系统 Docker 服务。')
  }
  if (!dockerReady(env)) {
    fail('Docker Engine 启动后仍不可用，请运行 docker info 检查。')
  }
}

export function restartMacDockerIfAvailable() {
  if (process.platform !== 'darwin' || !commandExists('colima')) {
    return
  }
  run('colima', ['ssh', '--', 'sudo', 'systemctl', 'set-environment', 'GODEBUG=http2client=0'], {
    allowFailure: true,
  })
  run('colima', ['ssh', '--', 'sudo', 'systemctl', 'restart', 'docker'], { allowFailure: true })
}

export function pullWithRetry(image, env) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    log(`正在拉取 ${image}（第 ${attempt}/5 次）`)
    if (run('docker', ['pull', image], { allowFailure: true, env })) {
      return
    }
    restartMacDockerIfAvailable()
  }
  fail(`连续 5 次无法拉取 ${image}。请检查网络或代理后重试。`)
}
