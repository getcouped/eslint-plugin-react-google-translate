/**
 * @fileoverview Tests for no-conditional-text-nodes-with-siblings.
 *
 * Every `valid` case below was checked against react-dom 18.3.1 by mounting it,
 * wrapping each text node in a `<font>` the way Google Translate does, then
 * flipping state — none of them throws. Every `invalid` case throws.
 */
'use strict';

const { RuleTester } = require('eslint');
const rule = require('../../../lib/rules/no-conditional-text-nodes-with-siblings');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

const conditional = { messageId: 'conditional-text-node' };
const preceded = { messageId: 'text-node-preceded-by-conditional' };

ruleTester.run('no-conditional-text-nodes-with-siblings', rule, {
  valid: [
    // No siblings: nothing to insert before or remove around. And a single
    // string child takes the shouldSetTextContent path, so React creates no
    // HostText fiber at all.
    '<p>{val ? "foo" : "bar"}</p>',
    '<p>{val || "bar"}</p>',
    '<p>{val && "foo"}</p>',

    // getHostSibling searches forward only, so a conditional *after* the text
    // is not a hazard.
    '<p>text {val ? <span>a</span> : <span>b</span>}</p>',
    '<p>{"text"}{val ? <span>a</span> : <span>b</span>}</p>',

    // Both branches render an element.
    '<p>{val ? <span>a</span> : <span>b</span>}<span>c</span></p>',

    // Every branch is a single bare text node: React reuses the one HostText
    // fiber and only assigns nodeValue, so nothing is inserted or removed.
    '<p>{val ? "foo" : "bar"} <span>x</span></p>',
    '<p>{val ? 1 : 2} <span>x</span></p>',
    '<p>{val ? `a${x}` : `b${x}`} <span>x</span></p>',
    '<p>{val ? "a" : val2 ? "b" : "c"} <span>x</span></p>',

    // `''` renders nothing: the reconciler guard is `newChild !== ''`. With an
    // element on the other branch, no bare text ever exists here.
    '<p>{val ? <Badge>{val}</Badge> : ""} <span>x</span></p>',
    '<p>{val ? <span>a</span> : ""}<span>x</span></p>',
    '<p>{val ? "" : <span>a</span>}<span>x</span></p>',

    // map()/flatMap() with a JSX-returning callback produces ReactElement[],
    // never a bare text node — including through optional chaining.
    '<p>{val ? <b>x</b> : items.map((i) => <input key={i} />)}<span>y</span></p>',
    '<p>{val ? <b>x</b> : items?.map((i) => <input key={i} />)}<span>y</span></p>',
    '<p>{val && items?.map((i) => <input key={i} />)}<span>y</span></p>',
    '<p>{val && items.flatMap((i) => <input key={i} />)}<span>y</span></p>',
    `<p>{val && items?.map((i) => {
        const x = i * 2;
        return <input key={x} />;
      })}<span>y</span></p>`,

    // A preceding conditional whose branches are all a single bare text node
    // keeps one fiber alive, so it never inserts before what follows.
    '<p>{val ? "a" : "b"}<span>x</span>tail</p>',
    '<p>{val ? "a" : "b"}{"static"}<span>x</span></p>',

    // The test of a conditional is evaluated, not rendered.
    '<p>{val === "%" ? <b>x</b> : <i>y</i>}<span>s</span></p>',

    // Attributes are not children.
    '<p><Foo bar={val ? "a" : ""} />{"x"}<span>y</span></p>',
  ],

  invalid: [
    // The text unmounts when `val` flips: `''` renders nothing, so the report
    // belongs on the branch that produces the text node.
    {
      code: '<p>{val ? "foo" : ""} <span>x</span></p>',
      errors: [conditional],
    },
    {
      code: '<p>{val ? "" : "foo"} <span>x</span></p>',
      errors: [conditional],
    },
    // `&&` renders nothing on the falsy branch, so the text mounts and unmounts.
    {
      code: '<p>{val && "foo"}<span>x</span></p>',
      errors: [conditional],
    },
    {
      code: '<p>{val && `foo${x}`}<span>x</span></p>',
      errors: [conditional],
    },
    // A fragment of bare text on one branch, nothing on the other: React's
    // deletion path removes the nearest host children of the deleted subtree.
    {
      code: '<p>{val ? <>bare {name} text</> : ""}<span>x</span></p>',
      errors: [conditional],
    },
    {
      code: '<p>{val && <>bare text</>}<span>x</span></p>',
      errors: [conditional],
    },
    // Text on one branch, an element on the other: the text node is deleted.
    {
      code: '<p>{val ? "foo" : <span>b</span>} <span>y</span></p>',
      errors: [conditional],
    },
    // Undecidable member and optional-chain expressions stay reported.
    {
      code: '<p>{val ? obj.a : <span>b</span>} <span>y</span></p>',
      errors: [conditional],
    },
    {
      code: '<p>{val ? obj?.a : <span>b</span>} <span>y</span></p>',
      errors: [conditional],
    },
    // Static text preceded by a conditional that can mount.
    {
      code: '<p>{val ? <span>a</span> : <span>b</span>} tail</p>',
      errors: [preceded],
    },
    {
      code: '<p>{val && <i>icon</i>} tail</p>',
      errors: [preceded],
    },
    // Both branches are text, so H1 is exempt — but a preceding conditional can
    // still insertBefore against the reused text node. These two behaviours are
    // coupled: exempting H1 without this check would be a false negative.
    {
      code: '<p>{val && <i>icon</i>}{val ? "foo" : "bar"}<span>x</span></p>',
      errors: [preceded],
    },
    {
      code: '<p>{val ? <a>A</a> : <b>B</b>}{"static"}<span>x</span></p>',
      errors: [preceded],
    },
    // Two hazards in one element. Errors are in source order, and the second
    // container earns both: its text toggles (H1) and the first container can
    // mount before it (H2).
    {
      code: '<p>{val && "foo"}{val2 && "bar"}<span>x</span></p>',
      errors: [conditional, preceded, conditional],
    },
  ],
});
