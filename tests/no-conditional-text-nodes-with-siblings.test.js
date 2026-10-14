'use strict';

const rule = require('../lib/rules/no-conditional-text-nodes-with-siblings');
const { ruleTester, typedRuleTester, typedFilename } = require('./rule-tester');

const CONDITIONAL = { messageId: 'conditional-text-node' };
const PRECEDED = { messageId: 'text-node-preceded-by-conditional' };

ruleTester.run('no-conditional-text-nodes-with-siblings', rule, {
  valid: [
    // conditionally rendered text nodes with no siblings won't throw
    '<p>{val || "bar"}</p>',
    '<p>{val ? "foo" : "bar"}</p>',
    // conditional expression follows the static text node and won't throw
    '<p>hello world {val ? <span>foo</span> : <span>bar</span>}</p>',
    // wrapped
    '<p>{val ? <span>foo</span> : <span>bar</span>}<span>hello world</span></p>',
    '<p>{val && <span>foo</span>} <span>hello world</span></p>',
    // empty strings render nothing
    '<p>{val && ""} <span>x</span></p>',
    // a component element is not a text node by default
    '<p>{val && <FormattedMessage id="a" />} <span>x</span></p>',
    '<p>{val && <b>x</b>}<FormattedMessage id="a" /></p>',
    // with the option, the component is fine without siblings or once wrapped
    {
      code: '<p>{val && <FormattedMessage id="a" />}</p>',
      options: [{ textComponents: ['FormattedMessage'] }],
    },
    {
      code: '<p>{val && <span><FormattedMessage id="a" /></span>} <span>x</span></p>',
      options: [{ textComponents: ['FormattedMessage'] }],
    },
    {
      code: '<p><FormattedMessage id="a" /> {val && <b>x</b>}</p>',
      options: [{ textComponents: ['FormattedMessage'] }],
    },
  ],

  invalid: [
    {
      code: '<p>{val ? "foo" : "bar"} <span>hello world</span></p>',
      errors: [CONDITIONAL, CONDITIONAL],
    },
    {
      code: '<p>{val ? <span>foo</span> : <span>bar</span>} hello world</p>',
      errors: [PRECEDED],
    },
    {
      code: '<p>{val && "foo"}<span>hello world</span></p>',
      errors: [CONDITIONAL],
    },
    {
      code: '<p>{val ? `foo ${bar}` : <span>bar</span>} <span>hello</span></p>',
      errors: [CONDITIONAL],
    },
    {
      code: '<p>{val ? obj.a : <span>bar</span>} <span>hello</span></p>',
      errors: [CONDITIONAL],
    },
    // textComponents: the component is a text node rendered conditionally
    // next to siblings
    {
      code: '<p>{val && <FormattedMessage id="a" />} <span>x</span></p>',
      options: [{ textComponents: ['FormattedMessage'] }],
      errors: [CONDITIONAL],
    },
    {
      code: '<p>{val ? <FormattedMessage id="a" /> : <span>b</span>}<span>x</span></p>',
      options: [{ textComponents: ['FormattedMessage'] }],
      errors: [CONDITIONAL],
    },
    {
      code: '<p>{val && <Intl.FormattedNumber value={1} />} <span>x</span></p>',
      options: [{ textComponents: ['Intl.FormattedNumber'] }],
      errors: [CONDITIONAL],
    },
    // textComponents: the component is a text node that follows a
    // conditional sibling
    {
      code: '<p>{val && <b>x</b>}<FormattedMessage id="a" /></p>',
      options: [{ textComponents: ['FormattedMessage'] }],
      errors: [PRECEDED],
    },
  ],
});

typedRuleTester.run('no-conditional-text-nodes-with-siblings (typed)', rule, {
  valid: [
    {
      filename: typedFilename,
      code: `
        declare const val: boolean;
        declare const icon: { type: string };
        export const a = <p>{val && icon} <span>x</span></p>;
      `,
    },
  ],
  invalid: [
    {
      filename: typedFilename,
      code: `
        declare const val: boolean;
        declare const label: string;
        export const a = <p>{val && label} <span>x</span></p>;
      `,
      errors: [CONDITIONAL],
    },
    {
      filename: typedFilename,
      code: `
        declare const val: boolean;
        declare function getLabel(): string;
        export const a = <p>{val ? getLabel() : <span>b</span>} <span>x</span></p>;
      `,
      errors: [CONDITIONAL],
    },
  ],
});
