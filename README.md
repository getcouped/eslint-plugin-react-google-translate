# eslint-plugin-react-google-translate

ESLint plugin to highlight code patterns in React applications which can lead to browser exceptions while the Google Translate browser extension is in use. This is a common problem for React applications and a known issue to both [React](https://github.com/facebook/react/issues/11538#issuecomment-390386520) and [Google](https://issues.chromium.org/issues/41407169).

When active on a page, the Google Translate browser extension is very liberal with its DOM manipulation, notably, replacing text nodes with `font` tags. This can be a problem for React applications as it can cause exceptions to be thrown when _conditionally_ rendering text nodes with siblings within JSX expressions.

Whilst many proposals have been suggested to avoid browser issues, this ESLint plugin aims to solve the problem far earlier in the development process by highlighting certain code patterns to the developer which can cause a browser exception to be thrown where Google Translate is in use.

Examples of code that can throw:

```jsx
function SomeComponent({ val }) {
  return (
    <div>
      <p>
        // ❌ foo & bar must be wrapped
        {val ? 'foo' : 'bar'} <span>hello world</span>
      </p>
      <p>
        // ❌ static text nodes must be wrapped when they are preceded by a
        conditional expression
        {val ? <span>foo</span> : <span>bar</span>} hello world
      </p>
      // ❌ all text must be wrapped in spans ('foo', 'bar' & 'hello world')
      <p>{val ? 'foo' : 'bar'} hello world</p>
      <p>
        // ❌ `val.toLocaleString()` returns a text node and should be wrapped
        {val ? val.toLocaleString() : <span>bar</span>} <span>hello world</span>
      </p>
      <p>
        // ❌ object properties rendering a text node should be wrapped
        {val ? obj.a : <span>bar</span>} <span>hello</span>
      </p>
      <p>
        // ❌ 'foo' needs to be wrapped in a span (expression has a sibling)
        {val && 'foo'}
        <span>hello world</span>
      </p>
      // ✅ conditionally rendered text nodes with no siblings won't throw
      <p>{val || 'bar'}</p>
      // ✅ conditionally rendered text nodes with no siblings won't throw
      <p>{val ? 'foo' : 'bar'}</p>
      // ✅ conditional expression follows the static text node and won't throw
      <p>hello world {val ? <span>foo</span> : <span>bar</span>}</p>
    </div>
  );
}
```

The safe way to write this code, avoiding browser exceptions, is to wrap each of the conditionally rendered text nodes (with siblings) in an element (for example, a `<span>`). Static text nodes with preceding conditionally rendered siblings must also be wrapped:

```jsx
function SomeComponent({ val }) {
  return (
    <div>
      // ✅ all text nodes are wrapped
      <p>
        {val ? <span>foo</span> : <span>bar</span>}
        <span>hello world</span>
      </p>
      <p>
        // ✅ `val.toLocaleString()` is wrapped
        {val ? <span>{val.toLocaleString()}</span> : <span>bar</span>}
        <span>hello world</span>
      </p>
      <p>
        // ✅ object properties rendering a text node are wrapped
        {val ? <span>{obj.a}</span> : <span>bar</span>} <span>hello</span>
      </p>
      <p>
        // ✅ 'foo' is wrapped (expression has a sibling)
        {val && <span>foo</span>} <span>hello world</span>
      </p>
      // ✅ conditionally rendered text, but no siblings
      <p>{val || 'bar'}</p>
      // ✅ conditionally rendered text, but no siblings
      <p>{val ? 'foo' : 'bar'}</p>
    </div>
  );
}
```

An additional problem identified is React components returning text nodes directly (or numerical values which will be rendered as text). When a React component returns values other than JSX / null, Google Translate can continue to display stale values after state changes, without any error being thrown. Since this is very hard to debug it is better to avoid it altogether.

```tsx
export function SomeComponent({ input }) {
  if (!input) {
    return null; // ✅ not a problem
  }

  if (input === 'a') {
    return 'A'; // ❌ the browser can display the stale value when state changes
  } else if (input === 'b') {
    return 2; // ❌ numerical values which are rendered as strings can also experience this
  } else if (input === 'c') {
    return `Template Litera${1}`; // ❌ template literals are displayed as strings and can also experience this
  } else {
    return <span>I am fine</span>; // ✅ returning JSX prevents the problem
  }
}
```

## Swapped elements with differently laid out text children (`no-unkeyed-text-element-swap`)

A third pattern crashes without any conditional text node: a parent rendering _one of several elements of the same type_ whose children are not laid out the same way (text nodes, `<br />`, inline elements in a different order or number), without distinct `key`s.

```jsx
const VALUES = [
  { body: <p>First sentence.<br />Second sentence.</p> },
  { body: <p>A community of 11{NBSP}000 pharmacies.<br />Second sentence.</p> },
];

// ❌ both bodies are a <p> at the same position
<div>{VALUES[index].body}</div>

// ❌ same thing, inline
<div>{product ? <p>Linked to <a href="/p">{product.id}</a></p> : <p>No product</p>}</div>
```

React keeps the same `<p>` and reconciles its children **by index**. Switching turns a `<br />` into a text node (or the reverse) and inserts the new node in front of a text node Google Translate has already replaced, which throws `NotFoundError: Failed to execute 'insertBefore' on 'Node'`.

Give each alternative a distinct `key`: React then unmounts one element and mounts the other, and only ever inserts elements, which Google Translate does not move.

```jsx
// ✅ distinct keys
const VALUES = [
  {
    body: (
      <p key="mission">
        First sentence.
        <br />
        Second sentence.
      </p>
    ),
  },
  {
    body: (
      <p key="community">
        A community of 11{NBSP}000 pharmacies.
        <br />
        Second sentence.
      </p>
    ),
  },
];

<div>{product ? <p key="linked">…</p> : <p key="none">No product</p>}</div>;
```

The rule resolves alternatives written inline, held by a top-level `const` of the same file, or read from a top-level `const` array of elements or of objects (`ITEMS[i]`, `ITEMS[i].body`). Alternatives coming from props or other modules are out of reach. An expression child of unknown kind (`{value}`) matches any kind when two layouts are compared, to avoid false positives. It accepts the same `textComponents` option as `no-conditional-text-nodes-with-siblings`.

## A component, a list or `children` before a text node (`no-dynamic-sibling-before-text`)

The crash needs a text node Google Translate has replaced, and a sibling React mounts _in front of it_ afterwards. `no-conditional-text-nodes-with-siblings` recognises that sibling when it is an inline conditional. It is just as dangerous when nothing is conditional in the JSX:

```jsx
function Alert({ message }) {
  if (!message) return null; // renders nothing until it has a message
  return <strong>{message}</strong>;
}

// ❌ when the alert mounts, React inserts it in front of the text node
<p>
  <Alert message={message} />
  You can contact us at any time.
</p>

// ❌ same with a list, or with children
<p>{items.map((item) => <Tag key={item} />)} suffix</p>
<p>{children} text</p>
```

The fix is the usual one: wrap the text in an element.

```jsx
// ✅
<p>
  <Alert message={message} />
  <span>You can contact us at any time.</span>
</p>
```

Host elements (`<b>`, `<span>`) never mount late and are not reported. Components known to always render an element (design-system primitives) are declared in `allowedComponents`; an entry written `/…/` is a regular expression:

```js
rules: {
  'react-google-translate/no-dynamic-sibling-before-text': [
    'error',
    {
      allowedComponents: ['Text', 'Heading', 'Icon', '/(Outlined|Filled|TwoTone)$/'],
      textComponents: ['FormattedMessage'],
    },
  ],
}
```

With type information, an expression that follows a conditional sibling is also reported when its type says it renders text (`{cond && <b />}{label}` with `label: string`). Known limit: a nullable text value before a text (`{price} €`) mounts a text node when it first gets a value; detecting it needs flow analysis.

This rule is not part of the `recommended` config: it needs `allowedComponents` tuned to your component library to stay quiet on components that always render an element.

## Installation

```sh
npm install eslint-plugin-react-google-translate --save-dev
```

## Usage (ESLint 9+, flat config)

Use the `recommended` config to enable the rules that need no configuration (`no-dynamic-sibling-before-text` is opted into separately, see below):

```js
// eslint.config.js
import reactGoogleTranslate from 'eslint-plugin-react-google-translate';

export default [reactGoogleTranslate.configs.recommended];
```

Or configure the rules individually (Each rule can be treated as a warning if an error is deemed too strict.):

```js
// eslint.config.js
import reactGoogleTranslate from 'eslint-plugin-react-google-translate';

export default [
  {
    plugins: {
      'react-google-translate': reactGoogleTranslate,
    },
    rules: {
      'react-google-translate/no-conditional-text-nodes-with-siblings': 'error',
      'react-google-translate/no-return-text-nodes': 'warn',
    },
  },
];
```

## Usage (ESLint 8, legacy `.eslintrc`)

The plugin still works with older ESLint versions using the legacy config format. Add `react-google-translate` to the plugins section of your `.eslintrc` configuration file:

```json
{
  "plugins": ["react-google-translate"],
  "rules": {
    "react-google-translate/no-conditional-text-nodes-with-siblings": "error",
    "react-google-translate/no-return-text-nodes": "error"
  }
}
```

## TypeScript

The plugin supports TypeScript and will use type information where available. Type-aware checks run _in addition_ to the standard pattern-based checks.

Where type information is unavailable (e.g. in JavaScript files or in Node versions earlier than 18.18), the plugin falls back to pattern matching only. This reduces coverage slightly, but the plugin will still catch most problematic patterns without types.

## Options

### `no-conditional-text-nodes-with-siblings`: `textComponents`

Some components render a bare text node rather than an element: react-intl's `<FormattedMessage />` (its default `textComponent` is `React.Fragment`), `<FormattedNumber />`, `<FormattedDate />`, `<FormattedTime />` and `<FormattedPlural />`, for instance. To Google Translate their output is a text node like any other, but the rule sees a JSX element and stays silent on both of its patterns:

```jsx
// ❌ a conditionally rendered text node with siblings
{
  compact && <FormattedMessage id="productsFound" />;
}
<span>My order</span>;

// ❌ a text node that follows a conditional sibling
{
  val && <b>x</b>;
}
<FormattedMessage id="hello" />;
```

List them in `textComponents` and they are checked exactly like text nodes (member expressions such as `Intl.FormattedNumber` are supported):

```js
rules: {
  'react-google-translate/no-conditional-text-nodes-with-siblings': [
    'error',
    {
      textComponents: [
        'FormattedMessage',
        'FormattedNumber',
        'FormattedDate',
        'FormattedTime',
        'FormattedPlural',
      ],
    },
  ],
}
```

The fix is the same as for any text node: `<span><FormattedMessage … /></span>`.

## Development

```sh
npm install
npm run lint
npm test
```

Tests are ESLint `RuleTester` cases under `tests/`, run by `tests/run.js`. The type-aware cases build a TypeScript program from `tests/fixtures/tsconfig.json`.
