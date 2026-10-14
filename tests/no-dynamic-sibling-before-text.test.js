'use strict';

const rule = require('../lib/rules/no-dynamic-sibling-before-text');
const { ruleTester, typedRuleTester, typedFilename } = require('./rule-tester');

const ERROR = { messageId: 'text-node-after-dynamic-sibling' };
const OPTIONS = [
  {
    allowedComponents: ['Text', '/(Outlined|Filled|TwoTone)$/'],
    textComponents: ['FormattedMessage'],
  },
];

ruleTester.run('no-dynamic-sibling-before-text', rule, {
  valid: [
    // wrapped: the fix
    '<p><Alert /><span>wrapped text</span></p>',
    '<p>{items.map((i) => <span key={i}>{i}</span>)}<span>suffix</span></p>',
    // host elements never mount late
    '<p><b>bold</b> text after a host element</p>',
    // allowed design-system components always render an element
    {
      code: '<p><Text weight={700}>free</Text> and without commitment</p>',
      options: OPTIONS,
    },
    {
      code: '<p><CloseOutlined /> text after an icon allowed by pattern</p>',
      options: OPTIONS,
    },
    // text first: the dynamic sibling is appended, not inserted before
    '<p>text before <Alert /></p>',
    '<p>text before{items.map((i) => <span key={i}>{i}</span>)}</p>',
    '<p>{label}{val && <b>x</b>}</p>',
    // constants render static text nodes
    '<p>{NBSP}text after a constant</p>',
    // element-only siblings: Google Translate leaves elements in place
    '<p><Alert /><span>text</span>{children}</p>',
    '<p>{icon}<b>bold</b></p>',
    '<p><Alert />{children}</p>',
    // a nullable text value before a text is a known gap
    '<p>{label} €</p>',
    // after a conditional, plain text is the other rule's business, and an
    // untyped expression is not reported
    '<p>{val && <b>x</b>} hello</p>',
    '<p>{val && <b>x</b>}{label}</p>',
    '<p>{val && <b>x</b>}{children}</p>',
    // a text component after a conditional is reported by the other rule
    {
      code: '<p>{val && <b>x</b>}<FormattedMessage id="a" /></p>',
      options: OPTIONS,
    },
    // returned fragment, wrapped
    '<><Alert /><span>suffix</span></>',
  ],

  invalid: [
    // a component that may render null first
    {
      code: '<p><Alert />text after a component</p>',
      errors: [ERROR],
    },
    {
      code: '<p><Icons.Alert />text after a member component</p>',
      errors: [ERROR],
    },
    // the component is not in allowedComponents
    {
      code: '<p><Alert />text after a component</p>',
      options: OPTIONS,
      errors: [ERROR],
    },
    // a list
    {
      code: '<p>{items.map((i) => <span key={i}>{i}</span>)}suffix</p>',
      errors: [ERROR],
    },
    {
      code: '<p>{items.filter(Boolean)}{`template ${label}`}</p>',
      errors: [ERROR],
    },
    // children
    {
      code: '<p>{children}{"literal"}</p>',
      errors: [ERROR],
    },
    // text-like victims: constant, text component
    {
      code: '<p><Alert />{NBSP}</p>',
      errors: [ERROR],
    },
    {
      code: '<p><Alert /><FormattedMessage id="a" /></p>',
      options: OPTIONS,
      errors: [ERROR],
    },
    // nested fragment flattened into the parent
    {
      code: '<p><><Alert /></>text after a fragment</p>',
      errors: [ERROR],
    },
    // returned fragment
    {
      code: '<>{items.map((i) => <span key={i}>{i}</span>)}suffix</>',
      errors: [ERROR],
    },
    // the error points at the text, not at the end of the previous tag
    {
      code: `
        <p>
          <Alert />
          text on its own line
        </p>
      `,
      errors: [{ ...ERROR, line: 4, column: 11 }],
    },
  ],
});

typedRuleTester.run('no-dynamic-sibling-before-text (typed)', rule, {
  valid: [
    // after a conditional, an expression typed as an element is fine
    {
      filename: typedFilename,
      code: `
        declare const val: boolean;
        declare const icon: { type: string };
        export const a = <p>{val && <b>x</b>}{icon}</p>;
      `,
    },
  ],
  invalid: [
    // after a conditional, an expression typed as text is a victim
    {
      filename: typedFilename,
      code: `
        declare const val: boolean;
        declare const label: string;
        export const a = <p>{val && <b>x</b>}{label}</p>;
      `,
      errors: [ERROR],
    },
    {
      filename: typedFilename,
      code: `
        declare const val: boolean;
        declare function getLabel(): string;
        export const a = <p>{val && <b>x</b>}{getLabel()}</p>;
      `,
      errors: [ERROR],
    },
    {
      filename: typedFilename,
      code: `
        declare const val: boolean;
        declare const user: { name: string };
        export const a = <p>{val && <b>x</b>}{user.name}</p>;
      `,
      errors: [ERROR],
    },
  ],
});
