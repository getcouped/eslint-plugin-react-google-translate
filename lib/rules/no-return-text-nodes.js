/**
 * @fileoverview React components should avoid returning text nodes directly (or numerical values which will be rendered as text). When a React component returns values other than JSX / null, Google Translate can continue to display stale values after state changes, without any error being thrown. Since this is very hard to debug it is better to avoid it altogether.
 * @author alistair-coup
 */
'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'React components should avoid returning text nodes directly (or numerical values which will be rendered as text). When a React component returns values other than JSX / null, Google Translate can continue to display stale values after state changes, without any error being thrown. Since this is very hard to debug it is better to avoid it altogether.',
    },
    schema: [],
    messages: {
      'return-value-is-text-node':
        'React components should avoid returning text nodes directly (or numerical values which will be rendered as text). When a React component returns values other than JSX / null, Google Translate can continue to display stale values after state changes, without any error being thrown. Since this is very hard to debug it is better to avoid it altogether.',
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

    function findAndReportReturnStatements(node) {
      if (node.type === 'ReturnStatement') {
        if (
          node.argument &&
          (node.argument.type === 'TemplateLiteral' ||
            (node.argument.type === 'Literal' &&
              (typeof node.argument.value === 'string' ||
                typeof node.argument.value === 'number')))
        ) {
          context.report({
            node,
            messageId: 'return-value-is-text-node',
          });
        }
      }

      if (node.type === 'BlockStatement') {
        const children = node.body || [];
        for (const child of children) {
          findAndReportReturnStatements(child);
        }
      } else if (node.type === 'IfStatement') {
        findAndReportReturnStatements(node.consequent);
        if (node.alternate) {
          findAndReportReturnStatements(node.alternate);
        }
      } else if (
        node.type === 'ForOfStatement' ||
        node.type === 'ForInStatement' ||
        node.type === 'ForStatement' ||
        node.type === 'WhileStatement' ||
        node.type === 'DoWhileStatement'
      ) {
        findAndReportReturnStatements(node.body);
      } else if (node.type === 'SwitchStatement') {
        for (const switchCase of node.cases) {
          for (const consequent of switchCase.consequent) {
            findAndReportReturnStatements(consequent);
          }
        }
      } else if (node.type === 'TryStatement') {
        findAndReportReturnStatements(node.block);
        if (node.handler) {
          findAndReportReturnStatements(node.handler.body);
        }
        if (node.finalizer) {
          findAndReportReturnStatements(node.finalizer);
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

        findAndReportReturnStatements(node.body);
      },
    };
  },
};
