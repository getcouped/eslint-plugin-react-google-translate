'use strict';

const path = require('node:path');
const { RuleTester } = require('eslint');

const FIXTURES = path.join(__dirname, 'fixtures');

const parserOptions = {
  ecmaVersion: 2022,
  sourceType: 'module',
  ecmaFeatures: { jsx: true },
};

/**
 * Pattern-based checks: JSX parsed by @typescript-eslint/parser, no type
 * information (`parserServices` unavailable, as in a plain JavaScript
 * project).
 */
const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions,
});

/**
 * Type-aware checks: a TypeScript program is built for each test case from
 * `tests/fixtures/tsconfig.json`. Test cases must set `filename` to
 * `typedFilename`.
 */
const typedRuleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ...parserOptions,
    tsconfigRootDir: FIXTURES,
    projectService: { allowDefaultProject: ['*.tsx'] },
  },
});

const typedFilename = path.join(FIXTURES, 'file.tsx');

module.exports = { ruleTester, typedRuleTester, typedFilename };
