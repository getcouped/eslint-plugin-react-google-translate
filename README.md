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

## Installation

```sh
npm install eslint-plugin-react-google-translate --save-dev
```

## Usage (ESLint 9+, flat config)

Use the `recommended` config to enable all rules:

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

## What makes a text node dangerous

A bare text node only matters if React creates a `HostText` fiber for it _and_ then removes it or uses it as an `insertBefore` reference. That splits into two hazards, which the rule checks separately (verified against react-dom 18.3.1 by mounting each shape, wrapping every text node in a `<font>` the way Translate does, then flipping state):

| Hazard | Condition | Example |
| --- | --- | --- |
| `removeChild` | a bare text node exists in one state and not in another | `{c ? 'a' : ''}` throws |
| `insertBefore` | a bare text node exists and a **preceding** sibling mounts | `{c && <i/>}{'text'}` throws |

Three consequences, which are why some plausible-looking code is deliberately _not_ reported:

- **`''` renders nothing.** The reconciler's guard is `typeof newChild === 'string' && newChild !== ''`, so an empty string never creates a `HostText` fiber and can never be the node that throws. When a conditional has an `''` branch, the hazard — if any — is the _other_ branch, and that is where the rule reports.
- **`{c ? 'a' : 'b'}` cannot throw via `removeChild`.** Both branches are a single bare text node, so React reuses one `HostText` fiber and only assigns `nodeValue`. It is still reported when a conditional _precedes_ it, because that is the `insertBefore` hazard.
- **`getHostSibling` searches forward only,** so the `insertBefore` hazard is asymmetric: a conditional _before_ the text is dangerous, one _after_ it is not.

## Known limitations

The rule fires only on conditionals, so a green lint does not mean "safe". This is a genuine `insertBefore` hazard that neither rule can see:

```jsx
{item?.icon}
{item?.label}          {/* bare text node; throws when icon mounts */}
{isLoading && <Spinner />}
```

Neither expression is a `ConditionalExpression` or a `LogicalExpression`, so neither is examined. Catching it means checking every child that can contribute text against every preceding sibling that can mount, which needs type information to stay precise.

Without types, `{cond ? label : ''}` is also undecidable: `label` could hold a string or a `ReactNode`. The rule reports member and optional-chain expressions in that position (its long-standing behaviour) but not bare identifiers, which would flag every node-typed value.
