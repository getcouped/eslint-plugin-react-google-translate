/**
 * @fileoverview Conditionally rendered text nodes should be wrapped in an element (for example, a <span>), otherwise Google Translate will cause a browser error.
 * @author alistair-coup
 */
'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Conditionally rendered text nodes should be wrapped in an element (for example, a <span>), otherwise Google Translate can cause a browser error.',
    },
    schema: [],
    messages: {
      'conditional-text-node':
        'When rendered as a direct child of a JSX element, conditionally rendered text nodes with siblings (elements or nodes) should be wrapped in an element (for example, a `<span>`) to prevent Google Translate causing a browser error while manipulating the DOM.',
      'text-node-preceeded-by-conditional':
        'When rendered as a direct child of a JSX element, static text nodes which are preceeded by a conditional expression should be wrapped in an element (for example, a `<span>`) to prevent Google Translate causing a browser error while manipulating the DOM.',
    },
  },

  create(context) {
    function isConditionallyRendered(node) {
      return (
        node.parent &&
        (node.parent.type === 'ConditionalExpression' ||
          node.parent.type === 'LogicalExpression')
      );
    }

    function isChildOfJSXEspressionContainer(node) {
      return node.parent && node.parent.type === 'JSXExpressionContainer';
    }

    function isChildOfJSXElement(node) {
      return node.parent && node.parent.type === 'JSXElement';
    }

    function hasSiblings(node) {
      return (
        node.parent &&
        node.parent.children &&
        node.parent.children.length > 1 &&
        node.parent.children.some(
          (child) => !Object.is(child, node) && !isWhitespace(child)
        )
      );
    }

    function isWhitespace(node) {
      return (
        (node.type === 'Literal' &&
          typeof node.value === 'string' &&
          node.value !== '' &&
          node.value.trim() === '') ||
        (node.type === 'JSXText' &&
          typeof node.value === 'string' &&
          node.value !== '' &&
          node.value.trim() === '')
      );
    }

    function conditionalSiblingsPreceedNode(node) {
      return (
        node.parent &&
        node.parent.children &&
        node.parent.children
          .filter(
            (child) =>
              (child.range ? child.range[0] : child.start) <
                (node.range ? node.range[0] : node.start) &&
              !isWhitespace(child)
          )
          .some(
            (child) =>
              child.type === 'JSXExpressionContainer' &&
              child.expression &&
              (child.expression.type === 'ConditionalExpression' ||
                child.expression.type === 'LogicalExpression')
          )
      );
    }

    function functionWasCalled(node) {
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'CallExpression') {
          return true;
        } else if (parent.type === 'ReturnExpression') {
          return false;
        }
        parent = parent.parent;
      }
      return false;
    }

    function isCondition(node) {
      if (node.parent && node.parent.type === 'ConditionalExpression') {
        console.log(
          'praent is conditional expression',
          Object.is(node.parent.test, node)
        );
        return Object.is(node.parent.test, node);
      } else if (node.parent && node.parent.type === 'LogicalExpression') {
        console.log(
          'praent is logical expression',
          Object.is(node.parent.left, node)
        );
        return Object.is(node.parent.left, node);
      }
      return false;
    }

    function isBinaryExpression(node) {
      if (node.parent && node.parent.type === 'BinaryExpression') {
        return isCondition(node.parent);
      }
      return false;
    }

    function getCallExpression(node) {
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'CallExpression') {
          return parent;
        }
        parent = parent.parent;
      }
      return null;
    }

    return {
      // conditionally rendered text nodes (string literals, or other literals
      // that are coerced to strings)
      Literal(node) {
        if (
          !isWhitespace(node) &&
          node.value !== null &&
          typeof node.value !== 'boolean' &&
          isConditionallyRendered(node) &&
          isChildOfJSXEspressionContainer(node.parent) &&
          node.parent.parent &&
          isChildOfJSXElement(node.parent.parent) &&
          hasSiblings(node.parent.parent)
        ) {
          context.report({
            node,
            messageId: 'conditional-text-node',
          });
        }
      },
      // conditionally rendered text nodes derived from template literal
      // expressions
      TemplateLiteral(node) {
        if (
          !isWhitespace(node) &&
          isConditionallyRendered(node) &&
          isChildOfJSXEspressionContainer(node.parent) &&
          node.parent.parent &&
          isChildOfJSXElement(node.parent.parent) &&
          hasSiblings(node.parent.parent)
        ) {
          context.report({
            node,
            messageId: 'conditional-text-node',
          });
        }
      },
      // static JSX text nodes preceeded by a conditional expression
      JSXText(node) {
        if (
          !isWhitespace(node) &&
          hasSiblings(node) &&
          conditionalSiblingsPreceedNode(node)
        ) {
          context.report({
            node,
            messageId: 'text-node-preceeded-by-conditional',
          });
        }
      },
      // text nodes which are derived fom object properties (only properties one
      // level deep are considered for now, and optional chaining is not
      // supported)
      MemberExpression(node) {
        if (isCondition(node) || isBinaryExpression(node)) {
          return;
        }
        if (
          isConditionallyRendered(node) &&
          isChildOfJSXEspressionContainer(node.parent) &&
          node.parent.parent &&
          isChildOfJSXElement(node.parent.parent) &&
          hasSiblings(node.parent.parent, node.value)
        ) {
          context.report({
            node,
            messageId: 'conditional-text-node',
          });
        }
      },
      // conditionally rendered text nodes generated by calling `toLocaleString`
      // or `toString`
      Identifier(node) {
        if (node.name === 'toLocaleString' && functionWasCalled(node)) {
          if (
            (node.name === 'toLocaleString' || node.name === 'toString') &&
            functionWasCalled(node)
          ) {
            const callExpression = getCallExpression(node);
            if (
              callExpression &&
              isConditionallyRendered(callExpression) &&
              callExpression.parent &&
              isChildOfJSXEspressionContainer(callExpression.parent) &&
              callExpression.parent.parent &&
              isChildOfJSXElement(callExpression.parent.parent) &&
              hasSiblings(callExpression.parent.parent)
            ) {
              context.report({
                node: callExpression,
                messageId: 'conditional-text-node',
              });
            }
          }
        }
      },
    };
  },
};
