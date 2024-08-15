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

    function getReturnStatement(node) {
      console.log(node.type, node);
      if (node.type === 'ReturnStatement') {
        return node;
      }

      if (node.type === 'BlockStatement') {
        const children = (node.body && node.body.statements) || [];
        for (const child of children) {
          return getReturnStatement(child) || null;
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        const functionName = getFunctionName(node.body);
        const isCapitalised = getIsCapitalised(functionName);
        const isFunctionComponent =
          typeof functionName === 'string' && isCapitalised;

        const returnStatement = getReturnStatement(node);
        console.log('returnStatement: ', returnStatement);

        if (isFunctionComponent) {
          context.report({
            node,
            messageId: 'react-component-returning-text-node',
          });
        }
      },
    };
  },
};
