/* eslint-disable @typescript-eslint/naming-convention */
import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.all,
  ...tseslint.configs.all,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // ...tseslint.configs.stylistic,
  {
    files: ['*.mjs', '*.js'],
    ignores: ['node_modules'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // Rule bugged in .js
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Rule bugged in .js
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        {
          ignoreVoidOperator: true
        }
      ],
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      '@typescript-eslint/prefer-readonly-parameter-types': [
        'error',
        {
          ignoreInferredTypes: true
        }
      ],
      'capitalized-comments': 'off',
      curly: ['error', 'multi'],
      'func-name-matching': 'off',
      'func-style': 'off',
      'id-length': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'multiline-comment-style': 'off',
      'no-console': 'off',
      'no-inline-comments': 'off',
      'no-plusplus': 'off',
      'no-undefined': 'off',
      'no-underscore-dangle': 'off',
      'no-void': 'off',
      'no-warning-comments': 'off',
      'one-var': 'off',
      'sort-imports': 'off'
    }
  }
]
