'use strict';

const test = require('node:test');
const { RuleTester } = require('eslint');

const rule = require('../lib/rules/no-conditional-text-nodes-with-siblings');

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    projectService: {
      allowDefaultProject: ['*.tsx'],
      // each test case is linted from a virtual file, and the default project
      // service caps how many of those it will track (8 by default)
      maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 32,
    },
    tsconfigRootDir: __dirname,
  },
});

// The branded string type is declared inline so the regression tests do not
// depend on an i18n library being installed. Any `string` subtype works the
// same way: branded, nominal or intersection types all fail a
// `typeToString(type) === 'string'` comparison while remaining assignable to
// `string`.
const types = `
type LocalizedString = string & { readonly __brand: 'LocalizedString' };
declare const Spinner: () => JSX.Element;
declare const m: { message: () => LocalizedString; plain: () => string };
declare function Component(props: { cond: boolean }): JSX.Element;
`;

test('no-conditional-text-nodes-with-siblings', () => {
  ruleTester.run('no-conditional-text-nodes-with-siblings', rule, {
    valid: [
      {
        // `any` is assignable to `string`, but tells us nothing about what the
        // value renders as, so it is deliberately not reported
        filename: 'valid-any.tsx',
        code: `${types}
declare const value: any;
export function A({ cond }: { cond: boolean }) {
  return <div>{cond ? value : null}<span>sibling</span></div>;
}`,
      },
      {
        // `never` is assignable to every type but is never actually rendered
        filename: 'valid-never.tsx',
        code: `${types}
declare const value: never;
export function A({ cond }: { cond: boolean }) {
  return <div>{cond ? value : null}<span>sibling</span></div>;
}`,
      },
      {
        // values which are not assignable to `string` or `number` are not text
        filename: 'valid-non-stringifiable.tsx',
        code: `${types}
declare const flag: boolean;
declare const obj: { a: number };
export function A({ cond }: { cond: boolean }) {
  return (
    <div>
      {cond ? flag : null}
      {cond ? obj : null}
      <span>sibling</span>
    </div>
  );
}`,
      },
      {
        // conditionally rendered text nodes without siblings cannot throw
        filename: 'valid-no-siblings.tsx',
        code: `${types}
declare const text: LocalizedString;
export function A({ cond }: { cond: boolean }) {
  return <div>{cond ? text : null}</div>;
}`,
      },
    ],
    invalid: [
      {
        // regression: a branded string returned by a call, used in the
        // canonical shape from the React issue (conditional sibling followed by
        // a text node)
        filename: 'invalid-branded-call-preceded.tsx',
        code: `${types}
export function A({ cond }: { cond: boolean }) {
  return <div>{cond ? <Spinner /> : null}{m.message()}<span>sibling</span></div>;
}`,
        errors: [{ messageId: 'text-node-preceded-by-conditional' }],
      },
      {
        // regression: a branded string is a conditional branch
        filename: 'invalid-branded-call-branch.tsx',
        code: `${types}
export function A({ cond }: { cond: boolean }) {
  return <div>{cond ? m.message() : null}<span>sibling</span></div>;
}`,
        errors: [{ messageId: 'conditional-text-node' }],
      },
      {
        // regression: a branded string held in a variable
        filename: 'invalid-branded-identifier.tsx',
        code: `${types}
declare const text: LocalizedString;
export function A({ cond }: { cond: boolean }) {
  return <div>{cond ? text : null}<span>sibling</span></div>;
}`,
        errors: [{ messageId: 'conditional-text-node' }],
      },
      {
        // regression: string literal types and unions of them are text, but do
        // not stringify to exactly `'string'`
        filename: 'invalid-string-literal-type.tsx',
        code: `${types}
declare const literal: 'a';
declare const union: 'a' | 'b';
export function A({ cond }: { cond: boolean }) {
  return (
    <div>
      {cond ? literal : null}
      {cond ? union : null}
      <span>sibling</span>
    </div>
  );
}`,
        errors: [
          { messageId: 'conditional-text-node' },
          { messageId: 'conditional-text-node' },
        ],
      },
      {
        // existing behaviour: a plain `string` is still reported
        filename: 'invalid-plain-string.tsx',
        code: `${types}
export function A({ cond }: { cond: boolean }) {
  return <div>{cond ? m.plain() : null}<span>sibling</span></div>;
}`,
        errors: [{ messageId: 'conditional-text-node' }],
      },
      {
        // existing behaviour: a plain `number` is still reported
        filename: 'invalid-plain-number.tsx',
        code: `${types}
declare const count: number;
export function A({ cond }: { cond: boolean }) {
  return <div>{cond ? count : null}<span>sibling</span></div>;
}`,
        errors: [{ messageId: 'conditional-text-node' }],
      },
    ],
  });
});
