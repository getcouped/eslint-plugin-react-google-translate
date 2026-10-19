'use strict';

const { ESLintUtils } = require('@typescript-eslint/utils');

/**
 * Type information for a rule, when the parser provides it (TypeScript with
 * `project` / `projectService`). `available` is `false` otherwise, and
 * `couldBeString` then always returns `false`.
 */
function createTypeHelpers(context) {
  let parserServices = null;
  let checker = null;
  try {
    parserServices = ESLintUtils.getParserServices(context);
    checker = parserServices.program.getTypeChecker();
  } catch {
    // type checking unavailable
  }

  function typeCouldBeString(type) {
    // `ReactNode` is a union of every renderable type, including `string`, so
    // reporting it would be too noisy: we cannot tell an element from text.
    if (type.aliasSymbol && type.aliasSymbol.name === 'ReactNode') {
      return false;
    }
    if (type.isUnion() || type.isIntersection()) {
      return type.types.some(typeCouldBeString);
    }
    const name = checker.typeToString(type);
    if (name === 'any' || name === 'never') return false;
    return (
      checker.isTypeAssignableTo(type, checker.getStringType()) ||
      checker.isTypeAssignableTo(type, checker.getNumberType())
    );
  }

  /** Whether the value of `node` may render as a text node (string/number). */
  function couldBeString(node) {
    if (!parserServices) return false;
    try {
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
      return typeCouldBeString(checker.getTypeAtLocation(tsNode));
    } catch {
      return false;
    }
  }

  return { available: parserServices !== null, couldBeString };
}

module.exports = { createTypeHelpers };
