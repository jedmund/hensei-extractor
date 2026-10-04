import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import ts from 'typescript-eslint'

export default ts.config(
  {
    ignores: ['node_modules/', '.output/', '.wxt/', 'src/paraglide/']
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions
      }
    },
    rules: {
      // TypeScript already checks for undefined names, and no-undef doesn't
      // understand types or ambient globals.
      'no-undef': 'off',
      // State updates copy a Set or Map and reassign the $state variable,
      // which is already reactive, so SvelteSet/SvelteMap aren't needed.
      'svelte/prefer-svelte-reactivity': 'off',
      // Keys matter for lists that reorder or hold per-item state; most of
      // ours are static display lists. Kept visible as a warning.
      'svelte/require-each-key': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte']
      }
    }
  }
)
