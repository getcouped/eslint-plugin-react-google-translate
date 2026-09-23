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
  overrides: [
    {
      files: ['tests/**/*.js'],
      rules: {
        // `node:test` works on every Node version in the `engines` range; it is
        // only flagged as experimental below Node 20
        'n/no-unsupported-features/node-builtins': [
          'error',
          { ignores: ['test'] },
        ],
      },
    },
  ],
};
