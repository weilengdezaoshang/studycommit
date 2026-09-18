export const testEnv = {
  NODE_ENV: 'test',
  API_PORT: '3001',
  DATABASE_URL: 'postgresql://studycommit:studycommit_test_only@localhost:5433/studycommit_test',
  REDIS_URL: 'redis://localhost:6380',
  AUTH_OTP_STUB: '123456',
  AUTH_WECHAT_STUB: '1',
  // 测试走内存对象存储,不需要 MinIO 容器
  S3_DRIVER: 'memory',
  // 对账截止缩短,便于在 e2e 中验证超时释放路径
  AI_RUN_RESULT_DEADLINE_MS: '4000',
  // 测试专用 32 字节全零密钥,不是真实服务商凭据
  AI_PROVIDER_ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
}
export function applyTestEnv() {
  Object.assign(process.env, testEnv)
}
