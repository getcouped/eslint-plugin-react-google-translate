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
        console.log('ReturnStatement', node);
        return node;
      }

      if (node.type === 'BlockStatement') {
        console.log('BlockStatement', node);
        const children = (node.body && node.body.statements) || [];
        for (const child of children) {
          return getReturnStatement(child) || null;
        }
      } else if (node.type === 'IfStatement') {
        console.log('IfStatement', node);
        return (
          getReturnStatement(node.consequent) ||
          (node.alternate && getReturnStatement(node.alternate)) ||
          null
        );
      } else if (
        node.type === 'ForOfStatement' ||
        node.type === 'ForInStatement' ||
        node.type === 'ForStatement' ||
        node.type === 'WhileStatement' ||
        node.type === 'DoWhileStatement'
      ) {
        console.log('LoopStatement', node);
        return getReturnStatement(node.body) || null;
      } else if (node.type === 'SwitchStatement') {
        console.log('SwitchStatement', node);
        for (const switchCase of node.cases) {
          for (const consequent of switchCase.consequent) {
            return getReturnStatement(consequent) || null;
          }
        }
      } else if (node.type === 'TryStatement') {
        console.log('TryStatement', node);
        return (
          getReturnStatement(node.block) ||
          (node.handler && getReturnStatement(node.handler.body)) ||
          (node.finalizer && getReturnStatement(node.finalizer)) ||
          null
        );
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
