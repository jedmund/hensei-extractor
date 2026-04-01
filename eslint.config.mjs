import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions
      }
    },
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  {
    ignores: ['node_modules/', '.output/', '.wxt/']
  }
]
