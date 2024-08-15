/**
 * @fileoverview React components should not return text nodes directly. Instead ensure to return JSX elements. Returning text nodes can cause tricky error to debug as Google Translate can continue to display stale text nodes after state changes, without any errors being thrown.
 * @author alistair-coup
 */
'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'React components should not return text nodes directly. Instead ensure to return JSX elements. Returning text nodes can cause tricky error to debug as Google Translate can continue to display stale text nodes after state changes, without any errors being thrown.',
    },
    schema: [],
    messages: {
      'react-component-returning-text-node':
        'React components should not return text nodes directly. Instead ensure to return JSX elements. Returning text nodes can cause tricky error to debug as Google Translate can continue to display stale text nodes after state changes, without any errors being thrown.',
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
        if (
          node.argument &&
          node.argument.type === 'Literal' &&
          typeof node.argument.value === 'string'
        ) {
          context.report({
            node,
            messageId: 'react-component-returning-text-node',
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
