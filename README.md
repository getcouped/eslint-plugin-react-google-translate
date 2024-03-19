# eslint-plugin-react-google-translate

ESLint plugin to highlight code patterns in React applications which can lead to browser exceptions while the Google Translate browser extension is in use.

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

## Rule

When active on a page, the Google Translate browser extension is very liberal with its DOM manipulation, notably, replacing text nodes with `font` tags. This can be a problem for React applications as it can cause an exception to be thrown when _conditionally_ rendering text nodes with siblings within JSX expressions.

(n.b. This is a known issue to both [React](https://github.com/facebook/react/issues/11538#issuecomment-390386520) and [Google](https://issues.chromium.org/issues/41407169).)

Whilst many proposals have been suggested to avoid browser issues, this ESLint plugin aims to solve the problem far earlier in the development process by highlighting certain code patterns to the developer which can cause a browser exception to be thrown where Google Translate is in use.

Examples of code that will throw:

```jsx
function SomeComponent({ val }) {
  return (
    <div>
      // ❌ all text must be wrapped in spans ('foo', 'bar' & 'hello world')
      <p>{val ? 'foo' : 'bar'} hello world</p>
      <p>
        // ❌ foo & bar must be wrapped
        {val ? 'foo' : 'bar'} <span>hello world</span>
      </p>
      <p>
        // ❌ 'hello world' must be wrapped
        {val ? <span>foo</span> : <span>bar</span>} hello world
      </p>
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
    </div>
  );
}
```

The correct way to write this code, avoiding browser exceptions is to wrap each of the conditionally rendered text nodes (with siblings) in an element (generally a `<span>`). Static text nodes with conditionally rendered siblings must also be wrapped:

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
        // ✅ `val.toLocaleString()` returns a text node and should be wrapped
        {val ? <span>{val.toLocaleString()}</span> : <span>bar</span>}
        <span>hello world</span>
      </p>
      <p>
        // ✅ object properties rendering a text node should be wrapped
        {val ? <span>{obj.a}</span> : <span>bar</span>} <span>hello</span>
      </p>
      <p>
        // ✅ 'foo' needs to be wrapped in a span (expression has a sibling)
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
