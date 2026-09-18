import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

/** 本机敏感配置放在仓库外；测试环境不读取开发者的私人配置。 */
export function getEnvFiles(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV === 'test') {
return ['.env.test.local', '.env.test']
}
  const externalFile =
    env.STUDYCOMMIT_CONFIG_FILE ?? join(homedir(), '.config', 'studycommit', 'api.env')
  if (!isAbsolute(externalFile)) {
throw new Error('STUDYCOMMIT_CONFIG_FILE 必须使用绝对路径')
}
  return [externalFile, '.env.local', '.env']
}
