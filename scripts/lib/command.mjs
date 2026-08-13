import { spawn, spawnSync } from 'node:child_process'

export function commandExists(command) {
  const probe = process.platform === 'win32' ? ['where', [command]] : ['sh', ['-lc', `command -v ${command}`]]
  return spawnSync(probe[0], probe[1], { stdio: 'ignore' }).status === 0
}

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: options.quiet ? 'ignore' : 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.error) throw result.error
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(' ')} 执行失败（退出码 ${result.status}）`)
  }
  return result.status === 0
}

export function runForeground(command, args = [], options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  child.on('error', (error) => {
    console.error(`[StudyCommit] 无法启动 ${command}：${error.message}`)
    process.exitCode = 1
  })
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exitCode = code ?? 1
  })
}
