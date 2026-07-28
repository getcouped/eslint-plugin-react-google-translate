/**
 * @fileoverview Type-aware tests for no-conditional-text-nodes-with-siblings.
 *
 * These cover what only a type-checker can decide: whether an identifier, member
 * expression or call renders text. They are also the regression tests for
 * classifying a *narrowed* type — `{symbol === '%' ? symbol : ''}` gives the
 * consequent the literal type `"%"`, which a `typeToString(t) === 'string'` check
 * misses entirely.
 */
'use strict';

const path = require('node:path');
const { RuleTester } = require('eslint');
const rule = require('../../../lib/rules/no-conditional-text-nodes-with-siblings');

const fixtures = path.resolve(__dirname, '../../fixtures');

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: './tsconfig.json',
    tsconfigRootDir: fixtures,
  },
});

const conditional = { messageId: 'conditional-text-node' };

const wrap = (body) => `
declare const Badge: (props: { children?: React.ReactNode }) => JSX.Element;
export function C(props: {
  symbol: string;
  label: string;
  count: number;
  maybe?: string;
  node: React.ReactNode;
  icon: JSX.Element;
  items: string[];
  fn: () => string;
  jsxFn: () => JSX.Element;
}) {
  const { symbol, label, count, maybe, node, icon, items, fn, jsxFn } = props;
  return ${body};
}
`;

ruleTester.run('no-conditional-text-nodes-with-siblings (type-aware)', rule, {
  valid: [
    // The other branch is provably an element, and `''` renders nothing.
    { code: wrap('<p>{count ? <Badge>{count}</Badge> : ""} <span>x</span></p>'), filename: 'file.tsx' },
    { code: wrap('<p>{count ? icon : ""}<span>x</span></p>'), filename: 'file.tsx' },
    { code: wrap('<p>{count ? jsxFn() : ""}<span>x</span></p>'), filename: 'file.tsx' },

    // ReactNode stays undecided rather than flagging every node-typed value —
    // the behaviour the plugin committed to in getcouped#1.
    { code: wrap('<p>{count ? node : ""}<span>x</span></p>'), filename: 'file.tsx' },

    // map() over strings returning JSX is an element array, not text.
    { code: wrap('<p>{count ? <b>x</b> : items?.map((i) => <input key={i} />)}<span>y</span></p>'), filename: 'file.tsx' },

    // Both branches are a single bare text node: one HostText fiber, reused.
    { code: wrap('<p>{count ? symbol : label} <span>x</span></p>'), filename: 'file.tsx' },
    { code: wrap('<p>{count ? fn() : label} <span>x</span></p>'), filename: 'file.tsx' },
  ],

  invalid: [
    // The regression this fix exists for: `symbol` is narrowed to the literal
    // type `"%"` here, so the report must land on `symbol` — previously the rule
    // could only see the `''`, which is never the node that throws.
    {
      code: wrap('<p>{symbol === "%" ? symbol : ""}<input /></p>'),
      filename: 'file.tsx',
      errors: [conditional],
    },
    {
      code: wrap('<p>{symbol !== "%" ? symbol : ""}<input /></p>'),
      filename: 'file.tsx',
      errors: [conditional],
    },
    // A plain `string` against a branch that renders nothing.
    {
      code: wrap('<p>{count ? label : ""}<span>x</span></p>'),
      filename: 'file.tsx',
      errors: [conditional],
    },
    {
      code: wrap('<p>{count && label}<span>x</span></p>'),
      filename: 'file.tsx',
      errors: [conditional],
    },
    // `string | undefined` still renders text on the defined branch.
    {
      code: wrap('<p>{count && maybe}<span>x</span></p>'),
      filename: 'file.tsx',
      errors: [conditional],
    },
    // A number is rendered as text.
    {
      code: wrap('<p>{count ? count : ""}<span>x</span></p>'),
      filename: 'file.tsx',
      errors: [conditional],
    },
    // A call whose return type is `string`.
    {
      code: wrap('<p>{count ? fn() : <b>x</b>}<span>y</span></p>'),
      filename: 'file.tsx',
      errors: [conditional],
    },
    // A map() callback that does not return JSX: the type says `string[]`, whose
    // members are text, so this stays reported.
    {
      code: wrap('<p>{count && items.map((i) => String(i))}<span>y</span></p>'),
      filename: 'file.tsx',
      errors: [conditional],
    },
  ],
});
