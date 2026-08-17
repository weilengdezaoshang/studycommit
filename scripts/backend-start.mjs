import {
  ensureDocker,
  loadEnvFile,
  log,
  projectRoot,
  proxyEnv,
  restartMacDockerIfAvailable,
} from './lib/backend.mjs'
import { run, runForeground } from './lib/command.mjs'

try {
  const runtimeEnv = await proxyEnv()
  await ensureDocker(runtimeEnv)
  const env = loadEnvFile(runtimeEnv)
  log('正在启动 PostgreSQL 和 Redis')
  let started = false
  for (let attempt = 1; attempt <= 3 && !started; attempt += 1) {
    started = run('docker', ['compose', 'up', '-d', '--wait'], {
      cwd: projectRoot,
      env,
      allowFailure: true,
    })
    if (!started) {
      restartMacDockerIfAvailable()
    }
  }
  if (!started) {
    throw new Error('连续 3 次无法启动 PostgreSQL 和 Redis。')
  }
  log('正在执行数据库迁移')
  run('pnpm', ['--filter', '@studycommit/api', 'db:migrate'], { cwd: projectRoot, env })
  log(`后端已就绪：http://localhost:${env.API_PORT ?? 3000}/api`)
  log('按 Ctrl+C 停止 API；数据库容器会继续运行')
  runForeground('pnpm', ['--filter', '@studycommit/api', 'dev'], { cwd: projectRoot, env })
} catch (error) {
  console.error(`\n[StudyCommit] ${error.message}`)
  process.exitCode = 1
}
