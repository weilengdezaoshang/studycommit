import { commandExists, run } from './lib/command.mjs'
import {
  ensureDocker,
  loadEnvFile,
  log,
  projectRoot,
  proxyEnv,
  pullWithRetry,
} from './lib/backend.mjs'

async function setupPlatform(env) {
  if (process.platform === 'darwin') {
    if (!commandExists('brew'))
      throw new Error('macOS 未安装 Homebrew，请先访问 https://brew.sh 安装。')
    const packages = []
    if (!commandExists('colima')) packages.push('colima')
    if (!commandExists('docker')) packages.push('docker')
    if (!run('brew', ['list', 'docker-compose'], { quiet: true, allowFailure: true }))
      packages.push('docker-compose')
    if (packages.length) run('brew', ['install', ...packages], { env })
  } else if (process.platform === 'win32' && !commandExists('docker')) {
    if (!commandExists('winget'))
      throw new Error('Windows 缺少 winget，请手动安装 Docker Desktop。')
    log('正在调用 winget 安装 Docker Desktop，系统可能要求管理员授权和重启')
    run('winget', ['install', '--id', 'Docker.DockerDesktop', '-e'])
    throw new Error(
      'Docker Desktop 已安装。请重启 Windows、启动 Docker Desktop，然后再次执行 pnpm backend:setup。',
    )
  } else if (process.platform === 'linux' && !commandExists('docker')) {
    throw new Error(
      'Linux 未安装 Docker Engine，请按 https://docs.docker.com/engine/install/ 安装后重试。',
    )
  }
}

try {
  const env = await proxyEnv()
  await setupPlatform(env)
  await ensureDocker(env)
  loadEnvFile()
  log('正在安装 Node.js 项目依赖')
  run('pnpm', ['install'], { cwd: projectRoot, env })
  pullWithRetry('redis:8-alpine', env)
  pullWithRetry('pgvector/pgvector:pg17', env)
  log('环境准备完成，正在启动后端')
  run('pnpm', ['backend:start'], { cwd: projectRoot, env })
} catch (error) {
  console.error(`\n[StudyCommit Setup] ${error.message}`)
  process.exitCode = 1
}
