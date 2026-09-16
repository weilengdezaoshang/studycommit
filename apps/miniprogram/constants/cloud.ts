/**
 * 各小程序环境对应的云开发环境 ID。
 * 由部署者开通云开发后在微信开发者工具云控制台查得并回填；
 * 禁止把其他环境（尤其是生产）的环境 ID 硬编码到别处。
 * 回填为空时 wx.cloud.init 使用账号默认云环境。
 */
const CLOUD_ENV_IDS: Record<string, string> = {
  develop: '',
  trial: '',
  release: '',
}

export function getCloudEnvId(): string {
  const envVersion = wx.getAccountInfoSync().miniProgram.envVersion
  return CLOUD_ENV_IDS[envVersion] ?? ''
}
