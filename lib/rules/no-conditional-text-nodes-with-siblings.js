/**
 * @fileoverview Conditionally rendered text nodes should be wrapped in an element (for example, a <span>), otherwise Google Translate will cause a browser error.
 * @author alistair-coup
 */
'use strict';

let ESLintUtils = null;
try {
  // wrap this in a try catch to gracefully support older node versions which
  // are not compatible with `@typescript-eslint/utils`
  ESLintUtils = require('@typescript-eslint/utils').ESLintUtils;
} catch {
  console.log('Type checking unavailable');
}

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
        'Conditionally rendered text nodes with siblings (elements or nodes), when rendered as a direct child of a JSX element, should be wrapped in an element (for example, a <span>) to prevent Google Translate causing a browser error while manipulating the DOM. This also applies to return values from functions, so getString() would become <span>{getString()}</span>.',
      'text-node-preceded-by-conditional':
        'Text nodes which are preceded by a conditional expression, when rendered as a direct child of a JSX element, should be wrapped in an element (for example, a <span>) to prevent Google Translate causing a browser error while manipulating the DOM. This also applies to return values from functions, so getString() would become <span>{getString()}</span>.',
    },
  },

  create(context) {
    // when type checking is unavailable, `parserServices` will be `null`
    let parserServices = null;
    let checker = null;
    try {
      parserServices = ESLintUtils.getParserServices(context);
      checker = parserServices.program.getTypeChecker();
    } catch {
      console.log('Type checking unavailable');
    }

    function getTypeForNode(node) {
      try {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        const type = checker.getTypeAtLocation(tsNode);
        return checker.typeToString(type);
      } catch {
        return null;
      }
    }

    function returnsStringifiableValue(node) {
      const type = getTypeForNode(node);
      if (!type) return false;
      return type === 'string' || type === 'number';
    }

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

    function conditionalSiblingsPrecedeNode(node) {
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

    // walk up through nested conditionals to allow reporting problematic
    // nested values
    function getOutermostConditional(node) {
      let current = node;
      while (
        current.parent &&
        (current.parent.type === 'ConditionalExpression' ||
          current.parent.type === 'LogicalExpression')
      ) {
        current = current.parent;
      }
      return current;
    }

    function isProblematicConditional(node) {
      if (!isConditionallyRendered(node)) return false;
      const outermost = getOutermostConditional(node);
      return (
        isChildOfJSXEspressionContainer(outermost) &&
        isChildOfJSXElement(outermost.parent) &&
        hasSiblings(outermost.parent)
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
        return Object.is(node.parent.test, node);
      } else if (node.parent && node.parent.type === 'LogicalExpression') {
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
          node.value !== null &&
          typeof node.value !== 'boolean' &&
          !isWhitespace(node) &&
          isProblematicConditional(node)
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
        if (!isWhitespace(node) && isProblematicConditional(node)) {
          context.report({
            node,
            messageId: 'conditional-text-node',
          });
        }
      },
      // static JSX text nodes preceded by a conditional expression
      JSXText(node) {
        if (
          !isWhitespace(node) &&
          hasSiblings(node) &&
          conditionalSiblingsPrecedeNode(node)
        ) {
          context.report({
            node,
            messageId: 'text-node-preceded-by-conditional',
          });
        }
      },
      // conditionally rendered text nodes generated from a function call
      CallExpression(node) {
        if (parserServices) {
          if (
            isProblematicConditional(node) &&
            returnsStringifiableValue(node)
          ) {
            context.report({
              node,
              messageId: 'conditional-text-node',
            });
          }
          if (
            isChildOfJSXElement(node.parent) &&
            hasSiblings(node.parent) &&
            conditionalSiblingsPrecedeNode(node.parent) &&
            returnsStringifiableValue(node)
          ) {
            context.report({
              node,
              messageId: 'text-node-preceded-by-conditional',
            });
          }
          return;
        }
        if (
          node.callee.type === 'Identifier' &&
          (node.callee.name === 'formatMessage' || node.callee.name === 't') &&
          node.arguments.length > 0 &&
          isProblematicConditional(node)
        ) {
          context.report({
            node,
            messageId: 'conditional-text-node',
          });
        }
        if (
          node.callee.type === 'Identifier' &&
          (node.callee.name === 'formatMessage' || node.callee.name === 't') &&
          node.arguments.length > 0 &&
          isChildOfJSXElement(node.parent) &&
          hasSiblings(node.parent) &&
          conditionalSiblingsPrecedeNode(node.parent)
        ) {
          context.report({
            node,
            messageId: 'text-node-preceded-by-conditional',
          });
        }
      },
      // text nodes which are derived from object properties (optional chaining
      // is not supported)
      MemberExpression(node) {
        if (isCondition(node) || isBinaryExpression(node)) {
          return;
        }
        if (isProblematicConditional(node)) {
          context.report({
            node,
            messageId: 'conditional-text-node',
          });
        }
      },
      Identifier(node) {
        if (parserServices) {
          if (
            isProblematicConditional(node) &&
            returnsStringifiableValue(node)
          ) {
            context.report({
              node,
              messageId: 'conditional-text-node',
            });
          }
          if (
            isChildOfJSXElement(node.parent) &&
            hasSiblings(node.parent) &&
            conditionalSiblingsPrecedeNode(node.parent) &&
            returnsStringifiableValue(node)
          ) {
            context.report({
              node,
              messageId: 'text-node-preceded-by-conditional',
            });
          }
          // return early to prevent following code reporting twice when type
          // checking is available (these will show up in CallExpression when
          // type checking is available, but not when it isn't)
          return;
        }
        if (
          (node.name === 'toLocaleString' || node.name === 'toString') &&
          functionWasCalled(node)
        ) {
          const callExpression = getCallExpression(node);
          if (callExpression && isProblematicConditional(callExpression)) {
            context.report({
              node: callExpression,
              messageId: 'conditional-text-node',
            });
          }
        }
      },
    };
  },
};
