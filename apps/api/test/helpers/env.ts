export const testEnv = {
  NODE_ENV: 'test', API_PORT: '3001',
  DATABASE_URL: 'postgresql://studycommit:studycommit_test_only@localhost:5433/studycommit_test',
  REDIS_URL: 'redis://localhost:6380'
}
export function applyTestEnv() { Object.assign(process.env, testEnv) }
