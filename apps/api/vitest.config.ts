import { defineConfig, defineProject } from 'vitest/config'
export default defineConfig({
  test: {
    projects: [
      defineProject({ test: { name: 'unit', include: ['src/**/*.spec.ts'] } }),
      defineProject({
        test: {
          name: 'integration',
          include: ['test/integration/**/*.integration-spec.ts'],
          fileParallelism: false,
        },
      }),
      defineProject({
        test: { name: 'e2e', include: ['test/e2e/**/*.e2e-spec.ts'], fileParallelism: false },
      }),
    ],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
})
