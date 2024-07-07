/* eslint-disable @typescript-eslint/naming-convention */
import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'

// TODO: Enforce no braces in one statement functions

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
      '@typescript-eslint/ban-ts-comment': 'off',
      // @typescript-eslint recommend just using TS's noImplicitReturns
      '@typescript-eslint/consistent-return': 'off',
      // Rule bugged in .js
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Rule bugged in .js
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/max-params': 'off',
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        {
          ignoreVoidOperator: true
        }
      ],
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      '@typescript-eslint/prefer-readonly-parameter-types': [
        'error',
        {
          ignoreInferredTypes: true
        }
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowAny: false,
          allowArray: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: true, // Not an issue
          allowRegExp: false
        }
      ],
      // Revisit later
      '@typescript-eslint/strict-boolean-expressions': 'off',
      'capitalized-comments': 'off',
      curly: ['error', 'multi'],
      'func-name-matching': 'off',
      'func-style': 'off',
      'id-length': 'off',
      'line-comment-position': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'multiline-comment-style': 'off',
      'no-console': 'off',
      'no-implicit-coercion': [
        'error',
        {
          allow: ['!!']
        }
      ],
      // 'no-extra-boolean-cast': 'off',
      'no-inline-comments': 'off',
      'no-plusplus': 'off',
      'no-ternary': 'off',
      'no-undefined': 'off',
      'no-underscore-dangle': 'off',
      'no-void': 'off',
      'no-warning-comments': 'off',
      'one-var': 'off',
      'sort-imports': 'off'
    }
  }
]
