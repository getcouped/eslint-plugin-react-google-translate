/**
 * @fileoverview Conditionally rendered text nodes should be wrapped in an element (for example, a <span>), otherwise Google Translate will cause a browser error.
 * @author alistair-coup
 */
'use strict';

const { ESLintUtils } = require('@typescript-eslint/utils');
const {
  NO_TEXT,
  TEXT_ONE,
  TEXT_MANY,
  UNKNOWN,
  contributesText,
  createAnalysis,
  isConditional,
  isWhitespace,
  hasSiblings,
  startOf,
} = require('../text-node-contribution');

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Conditionally rendered text nodes should be wrapped in an element (for example, a `<span>`), otherwise Google Translate can cause a browser error.',
      url: 'https://github.com/getcouped/eslint-plugin-react-google-translate#eslint-plugin-react-google-translate',
    },
    schema: [],
    messages: {
      'conditional-text-node':
        'Conditionally rendered text nodes with siblings (elements or nodes), when rendered as a direct child of a JSX element, should be wrapped in an element (for example, a `<span>`) to prevent Google Translate causing a browser error while manipulating the DOM. This also applies to return values from functions, so `getString()` should become `<span>{getString()}</span>`.',
      'text-node-preceded-by-conditional':
        'Text nodes which are preceded by a conditional expression, when rendered as a direct child of a JSX element, should be wrapped in an element (for example, a `<span>`) to prevent Google Translate causing a browser error while manipulating the DOM. This also applies to return values from functions, so `getString()` should become `<span>{getString()}</span>`.',
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
      // type checking unavailable
    }

    const nameOf = (type) => {
      try {
        return checker.typeToString(type);
      } catch {
        return null;
      }
    };

    /**
     * Classify a TypeScript type as contributing a bare text node or not.
     *
     * Deliberately not `typeToString(type) === 'string'`: a narrowed value has a
     * *literal* type, so in `{symbol === '%' ? symbol : ''}` the consequent is
     * `"%"`, not `string`, and a string comparison misses it. Unions ignore
     * nullish members — `string | undefined` still renders text — and only commit
     * when every remaining member agrees, so a `ReactNode` stays UNKNOWN rather
     * than flagging every node-typed value.
     */
    const classifyType = (type) => {
      if (!type) return UNKNOWN;
      if (typeof type.isUnion === 'function' && type.isUnion()) {
        const parts = type.types.filter((part) => {
          const name = nameOf(part);
          return name !== 'undefined' && name !== 'null' && name !== 'never';
        });
        if (parts.length === 0) return NO_TEXT;
        const classified = parts.map(classifyType);
        if (classified.every((c) => c === TEXT_ONE)) return TEXT_ONE;
        if (classified.every(contributesText)) return TEXT_MANY;
        if (classified.every((c) => c === NO_TEXT)) return NO_TEXT;
        return UNKNOWN;
      }
      if (
        (typeof type.isStringLiteral === 'function' &&
          type.isStringLiteral()) ||
        (typeof type.isNumberLiteral === 'function' && type.isNumberLiteral())
      ) {
        return TEXT_ONE;
      }
      const name = nameOf(type);
      if (name === null) return UNKNOWN;
      if (name === 'string' || name === 'number') return TEXT_ONE;
      if (name === 'any' || name === 'unknown') return UNKNOWN;
      if (
        name === 'undefined' ||
        name === 'null' ||
        name === 'never' ||
        name === 'void' ||
        name === 'boolean' ||
        name === 'true' ||
        name === 'false'
      ) {
        return NO_TEXT;
      }
      // An array-like renders each element in turn, so `string[]` contributes
      // several text nodes while `JSX.Element[]` contributes none.
      if (typeof type.getNumberIndexType === 'function') {
        const element = type.getNumberIndexType();
        if (element) {
          const inner = classifyType(element);
          if (contributesText(inner)) return TEXT_MANY;
          return inner;
        }
      }
      // Elements, objects and everything else: not a bare text node.
      return NO_TEXT;
    };

    const resolveType = (node) => {
      if (!parserServices) return UNKNOWN;
      try {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        return classifyType(checker.getTypeAtLocation(tsNode));
      } catch {
        return UNKNOWN;
      }
    };

    const { contribution, togglingTextBranches, isStableTextConditional } =
      createAnalysis(resolveType);

    /**
     * Hazard H2: can something mount *before* this position? `getHostSibling`
     * searches forward only, so only preceding siblings matter. A preceding
     * conditional whose branches are all a single bare text node is skipped: it
     * keeps one fiber alive and never inserts or removes a host node.
     */
    const conditionalSiblingsPrecedeNode = (node) =>
      node.parent &&
      node.parent.children &&
      node.parent.children
        .filter(
          (child) => startOf(child) < startOf(node) && !isWhitespace(child)
        )
        .some(
          (child) =>
            child.type === 'JSXExpressionContainer' &&
            isConditional(child.expression) &&
            !isStableTextConditional(child.expression)
        );

    return {
      JSXExpressionContainer(node) {
        const parent = node.parent;
        if (
          !parent ||
          (parent.type !== 'JSXElement' && parent.type !== 'JSXFragment')
        ) {
          return;
        }
        if (!hasSiblings(node)) return;

        // H1 — a bare text node mounts or unmounts at this position.
        if (isConditional(node.expression)) {
          for (const branch of togglingTextBranches(node.expression)) {
            context.report({
              node: branch,
              messageId: 'conditional-text-node',
            });
          }
        }

        // H2 — a bare text node sits here and a preceding sibling can mount.
        // This applies however the text got here, conditional or not, which is
        // why `{c ? 'a' : 'b'}` is exempt from H1 but not from this.
        if (
          contributesText(contribution(node.expression)) &&
          conditionalSiblingsPrecedeNode(node)
        ) {
          context.report({
            node,
            messageId: 'text-node-preceded-by-conditional',
          });
        }
      },

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
    };
  },
};
