import { commandExists, run } from './lib/command.mjs'
import { log, projectRoot } from './lib/backend.mjs'

try {
  if (!commandExists('docker')) throw new Error('未找到 Docker 命令。')
  log('正在停止 StudyCommit 的 PostgreSQL 和 Redis 容器')
  run('docker', ['compose', 'down'], { cwd: projectRoot })
  log('后端环境已停止，数据库 Volume 和系统容器运行时均未删除或关闭')
} catch (error) {
  console.error(`\n[StudyCommit] ${error.message}`)
  process.exitCode = 1
}
