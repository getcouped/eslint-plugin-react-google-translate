/**
 * @fileoverview A text node preceded, in the same parent, by a component, a list or `children` must be wrapped in an element, otherwise Google Translate can cause a browser error when that sibling mounts.
 * @author AntoineDuComptoirDesPharmacies
 */
'use strict';

const { createTypeHelpers } = require('../utils/types');

/**
 * The crash needs a text node Google Translate has replaced and a sibling
 * React mounts *in front of it* afterwards: `parent.insertBefore(newNode,
 * replacedText)` throws NotFoundError. `no-conditional-text-nodes-with-
 * siblings` recognises that sibling when it is an inline conditional. It is
 * just as dangerous when it is a component that renders `null` first and an
 * element later (`<Alert /> text`), a list (`{items.map(...)} text`) or
 * `{children} text`, none of which is conditional in the JSX.
 */

const LIST_METHODS = new Set(['map', 'flatMap', 'filter']);
const MAYBE_TEXT_EXPRESSION_TYPES = new Set([
  'Identifier',
  'CallExpression',
  'MemberExpression',
  'ChainExpression',
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A text node preceded, in the same parent, by a component, a list or `children` must be wrapped in an element, otherwise Google Translate can cause a browser error when that sibling mounts.',
      url: 'https://github.com/getcouped/eslint-plugin-react-google-translate#eslint-plugin-react-google-translate',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedComponents: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
          textComponents: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      'text-node-after-dynamic-sibling':
        'This text node follows a sibling that may mount later ({{sibling}}). If that happens after Google Translate has modified the DOM, React fails to insert it and throws a browser error. Wrap the text in an element, e.g. a `<span>`.',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedComponents = createMatcher(options.allowedComponents || []);
    const textComponents = new Set(options.textComponents || []);
    const types = createTypeHelpers(context);
    const sourceCode = context.sourceCode || context.getSourceCode();

    function createMatcher(entries) {
      const names = new Set();
      const patterns = [];
      for (const entry of entries) {
        const match = /^\/(.*)\/$/.exec(entry);
        if (match) patterns.push(new RegExp(match[1]));
        else names.add(entry);
      }
      return (name) =>
        names.has(name) || patterns.some((pattern) => pattern.test(name));
    }

    function isWhitespace(node) {
      return (
        (node.type === 'JSXText' || node.type === 'Literal') &&
        typeof node.value === 'string' &&
        node.value.trim() === ''
      );
    }

    function isComment(node) {
      return (
        node.type === 'JSXExpressionContainer' &&
        node.expression.type === 'JSXEmptyExpression'
      );
    }

    function getJSXElementName(node) {
      const name = node.openingElement.name;
      if (name.type === 'JSXIdentifier') return name.name;
      if (name.type === 'JSXMemberExpression') {
        const parts = [];
        let current = name;
        while (current.type === 'JSXMemberExpression') {
          parts.unshift(current.property.name);
          current = current.object;
        }
        parts.unshift(current.name);
        return parts.join('.');
      }
      return null;
    }

    /** `<Foo />`, `<Foo.Bar />`: a React component, not a host element. */
    function isComponentElement(node) {
      if (node.type !== 'JSXElement') return false;
      const name = node.openingElement.name;
      return (
        name.type === 'JSXMemberExpression' ||
        (name.type === 'JSXIdentifier' && /^[A-Z]/.test(name.name))
      );
    }

    function isConstantIdentifier(node) {
      return node.type === 'Identifier' && /^[A-Z][A-Z0-9_]*$/.test(node.name);
    }

    function isConditional(node) {
      return (
        node.type === 'ConditionalExpression' ||
        node.type === 'LogicalExpression'
      );
    }

    function isListCall(node) {
      return (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.property.type === 'Identifier' &&
        LIST_METHODS.has(node.callee.property.name)
      );
    }

    /**
     * What may mount later, in the parent's DOM, in front of the children
     * that follow it. `null` when `child` cannot.
     */
    function getDynamicSibling(child) {
      if (child.type === 'JSXElement') {
        if (!isComponentElement(child)) return null;
        const name = getJSXElementName(child);
        if (allowedComponents(name) || textComponents.has(name)) return null;
        return { conditional: false, label: `<${name} />` };
      }
      if (child.type !== 'JSXExpressionContainer') return null;
      const expression = child.expression;
      if (isConditional(expression)) {
        return { conditional: true, label: 'a conditional expression' };
      }
      if (
        isListCall(expression) ||
        (expression.type === 'Identifier' && expression.name === 'children')
      ) {
        return {
          conditional: false,
          label: `\`{${sourceCode.getText(expression)}}\``,
        };
      }
      return null;
    }

    /**
     * Is `child` a text node the preceding dynamic sibling can break? After
     * a conditional, plain JSX text and text components are already reported
     * by `no-conditional-text-nodes-with-siblings`; an expression is
     * reported when its type says it renders text. After a component or a
     * list, only what is certainly text is reported, so that the rule stays
     * actionable without type information.
     */
    function isVictim(child, dynamic) {
      if (child.type === 'JSXText') {
        return !isWhitespace(child) && !dynamic.conditional;
      }
      if (child.type === 'JSXElement') {
        return (
          !dynamic.conditional && textComponents.has(getJSXElementName(child))
        );
      }
      if (child.type !== 'JSXExpressionContainer') return false;
      const expression = child.expression;
      if (expression.type === 'Literal') {
        return (
          (typeof expression.value === 'string' ||
            typeof expression.value === 'number') &&
          !isWhitespace(expression)
        );
      }
      if (expression.type === 'TemplateLiteral') return true;
      if (isConstantIdentifier(expression)) return true;
      return (
        dynamic.conditional &&
        MAYBE_TEXT_EXPRESSION_TYPES.has(expression.type) &&
        types.couldBeString(expression)
      );
    }

    /** A JSX text node starts right after the previous tag: point at the text. */
    function getLoc(node) {
      if (node.type !== 'JSXText') return undefined;
      const start = node.range[0] + node.value.search(/\S/);
      return {
        start: sourceCode.getLocFromIndex(start),
        end: sourceCode.getLocFromIndex(node.range[1]),
      };
    }

    // a fragment child contributes its own children to the parent's DOM
    function flattenChildren(parent) {
      return parent.children
        .filter((child) => !isWhitespace(child) && !isComment(child))
        .flatMap((child) =>
          child.type === 'JSXFragment' ? flattenChildren(child) : [child]
        );
    }

    function check(parent) {
      let dynamic = null;
      for (const child of flattenChildren(parent)) {
        if (dynamic && isVictim(child, dynamic)) {
          context.report({
            node: child,
            loc: getLoc(child),
            messageId: 'text-node-after-dynamic-sibling',
            data: { sibling: dynamic.label },
          });
        }
        if (!dynamic) dynamic = getDynamicSibling(child);
      }
    }

    return {
      JSXElement: check,
      JSXFragment(node) {
        // nested fragments are flattened into their JSX parent above; only a
        // fragment that is not itself a JSX child needs its own pass
        if (
          !node.parent ||
          (node.parent.type !== 'JSXElement' &&
            node.parent.type !== 'JSXFragment')
        ) {
          check(node);
        }
      },
    };
  },
};
