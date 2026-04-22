import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // 仕様上、テンプレートリテラルやコメント内で全角スペース(U+3000)を
      // 区切り文字として意図的に使用するため、これらのコンテキストでは許可する
      // (参照: docs/specs/ui/scene2-gate.md L78-81)
      'no-irregular-whitespace': ['error', {
        skipStrings: true,
        skipTemplates: true,
        skipComments: true,
      }],
    },
  },
])
