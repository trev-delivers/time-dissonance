import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  /* ds/ is vendored and generated — `node scripts/sync-ds.mjs` deletes and
     re-copies the whole folder, so anything fixed here is gone on the next
     pull. It is also not this app's code to hold to this app's rules.
     (It does not currently pass them: ds/js/behaviours.js references an
     undefined `btn` twice in mountConfetti, where the parameter is named
     `trigger`. That is a real ReferenceError at mount, reported upstream in
     ds-proposals/README.md, not something to silence by editing ds/.) */
  globalIgnores(['dist', 'ds']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
