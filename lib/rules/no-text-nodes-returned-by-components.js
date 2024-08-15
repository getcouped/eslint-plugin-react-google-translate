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
      console.log('node.type IN FUNCTION: ', node.type);
      if (node.type === 'ReturnStatement') {
        context.report({
          node,
          messageId: 'react-component-returning-text-node',
        });
      }

      if (node.type === 'BlockStatement') {
        console.log('BlockStatement', node);
        const children = node.body || [];
        for (const child of children) {
          getReturnStatement(child);
        }
      } else if (node.type === 'IfStatement') {
        console.log('IfStatement', node);
        getReturnStatement(node.consequent);
        if (node.alternate) {
          getReturnStatement(node.alternate);
        }
      } else if (
        node.type === 'ForOfStatement' ||
        node.type === 'ForInStatement' ||
        node.type === 'ForStatement' ||
        node.type === 'WhileStatement' ||
        node.type === 'DoWhileStatement'
      ) {
        console.log('LoopStatement', node);
        getReturnStatement(node.body);
      } else if (node.type === 'SwitchStatement') {
        console.log('SwitchStatement', node);
        for (const switchCase of node.cases) {
          for (const consequent of switchCase.consequent) {
            getReturnStatement(consequent);
          }
        }
      } else if (node.type === 'TryStatement') {
        console.log('TryStatement', node);
        getReturnStatement(node.block);
        if (node.handler) {
          getReturnStatement(node.handler.body);
        }
        if (node.finalizer) {
          getReturnStatement(node.finalizer);
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

        const returnStatement = getReturnStatement(node.body);
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
