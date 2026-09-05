module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.(ts|tsx)', '<rootDir>/src/**/*.test.(ts|tsx)'],
  moduleNameMapper: {
    '^@orpc/client$': '<rootDir>/src/test/orpc-client.cjs',
    '^@orpc/contract$': '<rootDir>/src/test/orpc-contract.cjs',
    '^@orpc/openapi-client/fetch$': '<rootDir>/src/test/orpc-openapi-client.cjs',
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/test/**', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 75,
      statements: 75,
    },
  },
}
