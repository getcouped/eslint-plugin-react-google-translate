'use strict';

const rule = require('../lib/rules/no-unkeyed-text-element-swap');
const { ruleTester } = require('./rule-tester');

const ERROR = { messageId: 'unkeyed-swap' };

ruleTester.run('no-unkeyed-text-element-swap', rule, {
  valid: [
    // distinct keys: React remounts the element instead of patching it
    `
      const VALUES = [
        { body: <p key="mission">Une phrase.<br />Une autre.</p> },
        { body: <p key="community">Une communauté de 11{NBSP}000 pharmacies.<br />Une autre.</p> },
      ];
      export const a = <div>{VALUES[index].body}</div>;
    `,
    `
      <div>
        {product ? (
          <p key="linked">Produit lié : <a href="/p">{product.id}</a></p>
        ) : (
          <p key="unlinked">Aucun produit lié</p>
        )}
      </div>
    `,
    // same layout: only text updates, nothing is inserted
    '<div>{val ? <p>oui</p> : <p>non</p>}</div>',
    `
      const ITEMS = [<p key="a">a<br />b</p>, <p key="b">c<br />d</p>];
      export const a = <div>{ITEMS[i]}</div>;
    `,
    // an unknown expression matches any layout
    '<div>{val ? <span>{getLabel()}</span> : <span>b</span>}</div>',
    // different element types: React replaces the whole element
    '<div>{val ? <p>a<br />b</p> : <span>c</span>}</div>',
    // no text child at all
    `
      const ITEMS = [<div><Icon /></div>, <div><Icon /><Icon /></div>];
      export const a = <div>{ITEMS[i]}</div>;
    `,
    // alternatives we cannot see (props, other modules)
    '<div>{val ? bodyA : bodyB}</div>',
    // not a JSX child
    'const x = val ? <p>a<br />b</p> : <p>c</p>;',
  ],

  invalid: [
    // the production crash: bodies of the same type read from a const array
    {
      code: `
        const VALUES = [
          { body: <p>Une phrase.<br />Une autre.</p> },
          { body: <p>Une communauté de 11{NBSP}000 pharmacies.<br />Une autre.</p> },
        ];
        export const a = <div>{VALUES[index].body}</div>;
      `,
      errors: [ERROR],
    },
    {
      code: `
        const BODIES = [<p>a</p>, <p>b</p>, <p>d<br />e</p>];
        export const a = <div>{BODIES[index]}</div>;
      `,
      errors: [ERROR],
    },
    // inline ternary
    {
      code: `
        <div>
          {product ? (
            <p>Produit lié : <a href="/p">{product.id}</a></p>
          ) : (
            <p>Aucun produit lié</p>
          )}
        </div>
      `,
      errors: [ERROR],
    },
    // alternatives held by top-level consts
    {
      code: `
        const LONG = <p>Un conflit détecté avec <b>un produit</b></p>;
        const SHORT = <p>Aucun conflit</p>;
        export const a = <div>{val ? LONG : SHORT}</div>;
      `,
      errors: [ERROR],
    },
    // nested ternary
    {
      code: '<div>{a ? <p>x<br />y</p> : b ? <p>z</p> : <p>w<br />v</p>}</div>',
      errors: [ERROR],
    },
    // inside a fragment
    {
      code: '<>{val ? <p>a<br />b</p> : <p>c</p>}</>',
      errors: [ERROR],
    },
    // the same key on both alternatives is not distinct
    {
      code: '<div>{val ? <p key="same">a<br />b</p> : <p key="same">c</p>}</div>',
      errors: [ERROR],
    },
    // a text component counts as a text child
    {
      code: `
        <div>
          {val ? (
            <span><FormattedMessage id="a" /> suite</span>
          ) : (
            <span>texte seul</span>
          )}
        </div>
      `,
      options: [{ textComponents: ['FormattedMessage'] }],
      errors: [ERROR],
    },
  ],
});
