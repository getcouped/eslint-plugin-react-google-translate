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

## Rule

When active on a page, the Google Translate browser extension is very liberal with its DOM manipulation, notably, replacing text nodes with `font` tags. This can be a problem for React applications as it can cause an exception to be thrown when _conditionally_ rendering text nodes with siblings within JSX expressions.

(n.b. This is a known issue to both [React](https://github.com/facebook/react/issues/11538#issuecomment-390386520) and [Google](https://issues.chromium.org/issues/41407169).)

Whilst many proposals have been suggested to avoid browser issues, this ESLint plugin aims to solve the problem far earlier in the development process by highlighting certain code patterns to the developer which will cause a browser exception to be thrown where Google Translate is in use.

Example of code that will throw:

```jsx
function SomeComponent({ val }) {
  return (
    <div>
      <p>{val ? 'foo' : 'bar'} hello world</p> // ❌ all text must be wrapped
      <p>
        {val ? 'foo' : 'bar'} <span>hello</span> // ❌ foo & bar must be wrapped
      </p>
      <p>
        {val && 'foo'} // ❌ 'foo' needs to be wrapped in a `span`
        <span>hello world</span>
      </p>
      <p>{val || 'bar'}</p> // ✅ conditionally rendered text, but no siblings
    </div>
  );
}
```

The correct way to write this code, avoiding browser exceptions is to wrap each of the conditionally rendered text nodes (with siblings) in an element (generally a `<span>`):

```jsx
function SomeComponent({ val }) {
  return (
    <div>
      <p>
        {val ? <span>foo</span> : <span>bar</span>} <span>hello world</span>
      </p>
      <p>
        {val && <span>foo</span>}
        <span>hello world</span>
      </p>
      <p>{val || 'bar'}</p> // ✅ still no need to wrap, due to no siblings
    </div>
  );
}
```
