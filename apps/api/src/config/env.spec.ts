import { describe, expect, it } from 'vitest'
import { validateEnv } from './env'

const valid = {
  NODE_ENV: 'test',
  API_PORT: '3001',
  DATABASE_URL: 'postgresql://u:p@localhost:5433/studycommit_test',
  REDIS_URL: 'redis://localhost:6380',
}
describe('validateEnv', () => {
  it('parses and converts a valid environment', () =>
    expect(validateEnv(valid).API_PORT).toBe(3001))
  it('rejects an invalid port', () =>
    expect(() => validateEnv({ ...valid, API_PORT: 'nope' })).toThrow('API_PORT'))
  it('rejects a non-test database in test', () =>
    expect(() =>
      validateEnv({ ...valid, DATABASE_URL: 'postgresql://u:p@localhost/studycommit' }),
    ).toThrow('_test'))
  it('rejects wrong URL protocols', () =>
    expect(() =>
      validateEnv({ ...valid, DATABASE_URL: 'mysql://localhost/studycommit_test' }),
    ).toThrow('PostgreSQL'))
})
