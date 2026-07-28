/**
 * @fileoverview Decides whether a JSX child expression contributes a bare text
 * node, which is what determines whether Google Translate can make React throw.
 * @author alistair-coup
 */
'use strict';

/**
 * A bare text node is only a hazard if React creates a `HostText` fiber for it
 * *and* then removes it or uses it as an `insertBefore` reference. Two separate
 * hazards follow, and they need separate checks:
 *
 *   H1 removeChild  - a bare text node exists at this position in one state and
 *                     not in another, so React deletes it. This needs the
 *                     branches of the conditional to *differ*: `{c ? 'a' : ''}`
 *                     throws, `{c ? 'a' : 'b'}` does not, because React reuses
 *                     the single HostText fiber and only assigns `nodeValue`.
 *
 *   H2 insertBefore - a bare text node exists at this position and a *preceding*
 *                     sibling mounts. `getHostSibling` searches forward only, so
 *                     this is asymmetric: a conditional *before* the text is a
 *                     hazard, one *after* it is not. The text itself need not be
 *                     conditional at all.
 *
 * Verified against react-dom 18.3.1 by mounting each shape, wrapping every text
 * node in a `<font>` the way Translate does, then flipping state.
 *
 * Two structural facts the rules have to respect:
 *   - `''` renders nothing. The reconciler's guard is
 *     `typeof newChild === 'string' && newChild !== ''`, so an empty string never
 *     creates a HostText fiber and can never be the node that throws.
 *   - When a host element's `children` prop is a *single* string or number,
 *     `shouldSetTextContent` makes React manage the text through the parent's
 *     `textContent` and no HostText fiber is created at all.
 */

/** Definitely no bare text node here (an element, `''`, null, false, ...). */
const NO_TEXT = 'no-text';
/** Exactly one bare text node and nothing else. */
const TEXT_ONE = 'text-one';
/** Text, but not as a lone node — a fragment, an array, text beside elements. */
const TEXT_MANY = 'text-many';
/** Undecidable: needs type information, or the type itself is ambiguous. */
const UNKNOWN = 'unknown';

const contributesText = (c) => c === TEXT_ONE || c === TEXT_MANY;

const isJsx = (node) =>
  !!node && (node.type === 'JSXElement' || node.type === 'JSXFragment');

const isConditional = (node) =>
  !!node &&
  (node.type === 'ConditionalExpression' || node.type === 'LogicalExpression');

/** Collect `return` statements belonging to this function, not to nested ones. */
function collectOwnReturns(node, out) {
  if (!node || typeof node.type !== 'string') return out;
  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  ) {
    return out;
  }
  if (node.type === 'ReturnStatement') {
    out.push(node);
    return out;
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) collectOwnReturns(item, out);
    } else if (value && typeof value.type === 'string') {
      collectOwnReturns(value, out);
    }
  }
  return out;
}

/** True when every path out of this callback returns JSX. */
function callbackReturnsJsx(fn) {
  if (
    !fn ||
    (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')
  ) {
    return false;
  }
  if (fn.body && fn.body.type !== 'BlockStatement') return isJsx(fn.body);
  const returns = collectOwnReturns(fn.body, []);
  return returns.length > 0 && returns.every((r) => isJsx(r.argument));
}

/**
 * `items.map(x => <li/>)` produces `ReactElement[]`, never a bare text node.
 * Only claimed when the callback demonstrably returns JSX, so `items.map(String)`
 * is left to the type-checker. This is the syntactic fallback for when type
 * information is unavailable.
 */
function isJsxReturningIteratorCall(node) {
  if (!node || node.type !== 'CallExpression') return false;
  const callee =
    node.callee && node.callee.type === 'ChainExpression'
      ? node.callee.expression
      : node.callee;
  if (!callee || callee.type !== 'MemberExpression') return false;
  const property = callee.property;
  const name =
    property &&
    (property.name ||
      (property.type === 'Literal' ? property.value : undefined));
  if (name !== 'map' && name !== 'flatMap') return false;
  return callbackReturnsJsx(node.arguments && node.arguments[0]);
}

const isI18nCall = (node) =>
  !!node &&
  node.type === 'CallExpression' &&
  node.callee &&
  node.callee.type === 'Identifier' &&
  (node.callee.name === 'formatMessage' || node.callee.name === 't') &&
  node.arguments.length > 0;

/**
 * Combine the children of a fragment or array. Such a group is never a lone text
 * node, so any text in it is TEXT_MANY: it sits beside other host children, and
 * deleting the group removes each of them.
 */
function combineGroup(parts) {
  if (parts.some(contributesText)) return TEXT_MANY;
  if (parts.some((c) => c === UNKNOWN)) return UNKNOWN;
  return NO_TEXT;
}

/** Combine the mutually exclusive branches of a conditional. */
function combineBranches(parts) {
  const texts = parts.filter(contributesText);
  if (texts.length === 0) {
    return parts.some((c) => c === UNKNOWN) ? UNKNOWN : NO_TEXT;
  }
  if (parts.some((c) => c === UNKNOWN)) return UNKNOWN;
  return texts.every((c) => c === TEXT_ONE) ? TEXT_ONE : TEXT_MANY;
}

/**
 * Build the contribution analysis. `resolveType` maps an AST node to one of the
 * four states using type information, or returns UNKNOWN when no checker is
 * available.
 */
function createAnalysis(resolveType) {
  /** Flatten nested conditionals into the set of expressions that can render. */
  function renderableBranches(expr, out = []) {
    if (!expr) return out;
    if (expr.type === 'ConditionalExpression') {
      renderableBranches(expr.consequent, out);
      renderableBranches(expr.alternate, out);
      return out;
    }
    if (expr.type === 'LogicalExpression') {
      if (expr.operator === '&&') {
        // The left side is the test. The falsy case renders nothing, and that is
        // a real branch — it is what makes the text node mount and unmount.
        renderableBranches(expr.right, out);
        out.push(null);
        return out;
      }
      renderableBranches(expr.left, out);
      renderableBranches(expr.right, out);
      return out;
    }
    out.push(expr);
    return out;
  }

  function contribution(node) {
    if (!node) return NO_TEXT;
    switch (node.type) {
      case 'Literal': {
        if (node.value === null || typeof node.value === 'boolean') {
          return NO_TEXT;
        }
        if (typeof node.value === 'string') {
          // Only `''` renders nothing. `{' '}` really does create a text node —
          // unlike whitespace-only *JSX* text, which the parser strips.
          return node.value === '' ? NO_TEXT : TEXT_ONE;
        }
        if (typeof node.value === 'number') return TEXT_ONE;
        return NO_TEXT;
      }
      case 'JSXText':
        return node.value.trim() === '' ? NO_TEXT : TEXT_ONE;
      case 'TemplateLiteral':
        return TEXT_ONE;
      case 'JSXElement':
        return NO_TEXT;
      // Fragments and expression containers are transparent: React flattens
      // them, so their text children become host children of the same parent.
      case 'JSXFragment':
        return combineGroup(node.children.map(contribution));
      case 'JSXExpressionContainer':
        return contribution(node.expression);
      case 'JSXEmptyExpression':
        return NO_TEXT;
      case 'ArrayExpression':
        return combineGroup((node.elements || []).map(contribution));
      case 'ConditionalExpression':
      case 'LogicalExpression':
        return combineBranches(renderableBranches(node).map(contribution));
      case 'ChainExpression':
        return contribution(node.expression);
      case 'CallExpression':
        if (isI18nCall(node)) return TEXT_ONE;
        if (isJsxReturningIteratorCall(node)) return NO_TEXT;
        return resolveType(node);
      case 'Identifier':
        if (node.name === 'undefined') return NO_TEXT;
        return resolveType(node);
      default:
        return resolveType(node);
    }
  }

  /**
   * A branch producing exactly one bare text node. When *every* branch is like
   * this React reuses a single HostText fiber across the update and only assigns
   * `nodeValue`, so nothing is inserted or removed.
   */
  const isSingleTextBranch = (node) => contribution(node) === TEXT_ONE;

  /**
   * Whether an UNKNOWN contribution should still be reported. Without a
   * conclusive type we cannot tell `{c ? obj.label : <b/>}` (a hazard) from
   * `{c ? obj.icon : <b/>}` (not one). Reporting is limited to the node kinds
   * this rule has always reported on, rather than widening to every identifier,
   * which would flag every `ReactNode`-typed value.
   */
  const reportsWhenUnknown = (node) =>
    !!node &&
    (node.type === 'MemberExpression' || node.type === 'ChainExpression');

  /** The branch nodes that can mount or unmount a bare text node (hazard H1). */
  function togglingTextBranches(expr) {
    const branches = renderableBranches(expr);
    if (branches.length < 2) return [];

    const flagged = branches.filter((branch) => {
      const c = contribution(branch);
      if (contributesText(c)) return true;
      return c === UNKNOWN && reportsWhenUnknown(branch);
    });
    if (flagged.length === 0) return [];

    // Every branch is a single bare text node: the fiber is reused, not moved.
    if (branches.every(isSingleTextBranch)) return [];

    return flagged;
  }

  /**
   * A conditional whose every branch is a single bare text node keeps exactly one
   * HostText fiber alive: React only assigns `nodeValue`, so it never inserts or
   * removes a host node and cannot trigger H2 in the nodes that follow it. In
   * contrast `{c ? <a/> : <b/>}` and `{c && <i/>}` both do.
   */
  const isStableTextConditional = (expr) =>
    isConditional(expr) && renderableBranches(expr).every(isSingleTextBranch);

  return {
    contribution,
    contributesText,
    togglingTextBranches,
    isStableTextConditional,
  };
}

/**
 * Whitespace that is not a meaningful sibling. `''` is excluded deliberately, so
 * it still counts as a sibling for `hasSiblings`. Whether `''` is a *text node*
 * is a separate question, answered by `contribution` — the distinction these
 * rules used to conflate.
 */
const isWhitespace = (node) =>
  ((node.type === 'Literal' && typeof node.value === 'string') ||
    (node.type === 'JSXText' && typeof node.value === 'string')) &&
  node.value !== '' &&
  node.value.trim() === '';

const startOf = (node) => (node.range ? node.range[0] : node.start);

/** Does the JSX parent of this child hold any other meaningful child? */
const hasSiblings = (node) =>
  node.parent &&
  node.parent.children &&
  node.parent.children.length > 1 &&
  node.parent.children.some(
    (child) => !Object.is(child, node) && !isWhitespace(child)
  );

module.exports = {
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
};
