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
        // ❌ static text nodes must be wrapped when they are preceeded by a
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

The safe way to write this code, avoiding browser exceptions, is to wrap each of the conditionally rendered text nodes (with siblings) in an element (for example, a `<span>`). Static text nodes with preceeding conditionally rendered siblings must also be wrapped:

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

You'll first need to install [ESLint](https://eslint.org/):

```sh
npm i eslint --save-dev
```

Next, install `eslint-plugin-react-google-translate`:

```sh
npm install eslint-plugin-react-google-translate --save-dev
```

## Usage

Add `react-google-translate` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
  "plugins": ["react-google-translate"]
}
```

Then configure the rule under the rules section.

```json
{
  "rules": {
    "react-google-translate/no-conditional-text-nodes-with-siblings": "error"
  }
}
```

The rule can also be treated as a warning if an error is deemed too strict.

```json
{
  "rules": {
    "react-google-translate/no-conditional-text-nodes-with-siblings": "warn"
  }
}
```

## Limitations

- This plugin will highlight instances where a text node is generated by calling `toString` or `toLocaleString`, though it is not able to identify text nodes returned from other functions. For example, the following code will not show an error.

```jsx
<p>
  {val ? getSomeValue() : <span>bar</span>} <span>hello world</span>
</p>
```

- Conditional expressions are limited to a single ternary operator. Values derived from nested ternary expressions will not be reported.

- Object properties are identified by the plugin, though only those which are one level deep.

```jsx
<p>
  // ✅ `val.a` is only one level deep and will be reported
  {showVal ? val.a : <span>bar</span>} <span>hello world</span>
  // ❌ `val.a.b` is two levels deep and will not be reported
  {showVal ? val.a.b : <span>bar</span>} <span>hello world</span>
</p>
```

- Optional chaining is not supported.

```jsx
<p>
  // ❌ `val?.a` uses optional chaining and will not be reported
  {showVal ? val?.a : <span>bar</span>} <span>hello world</span>
  // ❌ `toLocaleString` being optionally chained will also fail to report
  {showVal ? val?.toLocaleString() : <span>bar</span>} <span>hello world</span>
</p>
```
