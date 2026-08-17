import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/.pnpm-store/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'apps/desktop/test-results/**',
      'apps/desktop/playwright-report/**',
      'apps/api/drizzle/**',
      'docs/prototypes/**',
      'pnpm-lock.yaml',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/desktop/**/*.{ts,tsx}', 'apps/mobile/**/*.{ts,tsx}'],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  prettier,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      curly: ['error', 'all'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
    },
  },
)
