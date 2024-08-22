/**
 * @fileoverview React components should return JSX and should avoid returning text nodes directly. When a React component returns values other than JSX, Google Translate can continue to display stale values after state changes, without any error being thrown. Since this is very hard to debug is better to avoid returning text nodes directly from React components, and instead only return JSX elements.
 * @author alistair-coup
 */
'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'React components should return JSX and should avoid returning text nodes directly. When a React component returns values other than JSX, Google Translate can continue to display stale values after state changes, without any error being thrown. Since this is very hard to debug is better to avoid returning text nodes directly from React components, and instead only return JSX elements.',
    },
    schema: [],
    messages: {
      'return-value-is-not-jsx':
        'React components should return JSX and should avoid returning text nodes directly. When a React component returns values other than JSX, Google Translate can continue to display stale values after state changes, without any error being thrown. Since this is very hard to debug is better to avoid returning text nodes directly from React components, and instead only return JSX elements.',
    },
  },

  create(context) {
    function getFunctionName(node) {
      return node && node.id && node.id.name;
    }

    function getIsCapitalised(name) {
      return (
        name && typeof name === 'string' && name[0] === name[0].toUpperCase()
      );
    }

    function findReturnStatements(node) {
      if (node.type === 'ReturnStatement') {
        if (node.argument && node.argument.type !== 'JSXElement') {
          context.report({
            node,
            messageId: 'return-value-is-not-jsx',
          });
        }
      }

      if (node.type === 'BlockStatement') {
        const children = node.body || [];
        for (const child of children) {
          findReturnStatements(child);
        }
      } else if (node.type === 'IfStatement') {
        findReturnStatements(node.consequent);
        if (node.alternate) {
          findReturnStatements(node.alternate);
        }
      } else if (
        node.type === 'ForOfStatement' ||
        node.type === 'ForInStatement' ||
        node.type === 'ForStatement' ||
        node.type === 'WhileStatement' ||
        node.type === 'DoWhileStatement'
      ) {
        findReturnStatements(node.body);
      } else if (node.type === 'SwitchStatement') {
        for (const switchCase of node.cases) {
          for (const consequent of switchCase.consequent) {
            findReturnStatements(consequent);
          }
        }
      } else if (node.type === 'TryStatement') {
        findReturnStatements(node.block);
        if (node.handler) {
          findReturnStatements(node.handler.body);
        }
        if (node.finalizer) {
          findReturnStatements(node.finalizer);
        }
      } else {
        return null;
      }
    }

    return {
      FunctionDeclaration(node) {
        if (!node.body) return;

        const functionName = getFunctionName(node);
        const isCapitalised = getIsCapitalised(functionName);
        const isFunctionComponent =
          typeof functionName === 'string' && isCapitalised;

        if (!isFunctionComponent) return;
        findReturnStatements(node.body);
      },
    };
  },
};
