'use strict';

module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:eslint-plugin/recommended',
    'plugin:n/recommended',
  ],
  env: {
    node: true,
  },
  ignorePatterns: ['**/*.d.ts'],
  rules: {
    'n/no-missing-require': [
      'error',
      {
        allowModules: ['@typescript-eslint/utils'],
      },
    ],
  },
};
