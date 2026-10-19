/**
 * @fileoverview Elements of the same type whose text children are laid out differently must carry distinct keys when rendered in turn under one parent, otherwise Google Translate can cause a browser error when they are swapped.
 * @author AntoineDuComptoirDesPharmacies
 */
'use strict';

/**
 * A parent renders one of several elements of the same type whose children
 * are not laid out the same way (text nodes and inline elements in a
 * different order or number):
 *
 *   {cond ? <p>a <b>b</b></p> : <p>c</p>}
 *   {VALUES[index].body}
 *
 * React keeps the DOM element and reconciles its children by index, so
 * switching inserts a node in front of a text node Google Translate may have
 * replaced with a `<font>`: NotFoundError insertBefore. Nothing in either
 * alternative is conditional on its own, which is why
 * `no-conditional-text-nodes-with-siblings` cannot see it.
 *
 * Distinct `key`s make React unmount one element and mount the other, so
 * it only ever inserts elements, which Google Translate does not move.
 */

const TEXT_EXPRESSION_TYPES = new Set(['Literal', 'TemplateLiteral']);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Elements of the same type with differently laid out text children, rendered in turn under one parent, must carry distinct keys, otherwise Google Translate can cause a browser error when they are swapped.',
      url: 'https://github.com/getcouped/eslint-plugin-react-google-translate#eslint-plugin-react-google-translate',
    },
    schema: [
      {
        type: 'object',
        properties: {
          textComponents: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      'unkeyed-swap':
        'Two alternatives of the same element type rendered here have text children laid out differently. React keeps the same DOM element when switching and reconciles the children by index, which can make Google Translate cause a browser error. Give each alternative a distinct `key` so React remounts the element instead.',
    },
  },

  create(context) {
    const textComponents = new Set(
      (context.options[0] && context.options[0].textComponents) || []
    );

    // top-level `const` holding a JSX element or an array (of elements, or
    // of objects whose properties hold elements)
    const constants = new Map();

    function isWhitespace(node) {
      return (
        node.type === 'JSXText' &&
        typeof node.value === 'string' &&
        node.value.trim() === ''
      );
    }

    function isComment(node) {
      return (
        node.type === 'JSXExpressionContainer' &&
        node.expression.type === 'JSXEmptyExpression'
      );
    }

    function getJSXElementName(node) {
      const name = node.openingElement.name;
      if (name.type === 'JSXIdentifier') return name.name;
      if (name.type === 'JSXMemberExpression') {
        const parts = [];
        let current = name;
        while (current.type === 'JSXMemberExpression') {
          parts.unshift(current.property.name);
          current = current.object;
        }
        parts.unshift(current.name);
        return parts.join('.');
      }
      return null;
    }

    function isConstantIdentifier(node) {
      return node.type === 'Identifier' && /^[A-Z][A-Z0-9_]*$/.test(node.name);
    }

    function isTextChild(child) {
      if (child.type === 'JSXText') return !isWhitespace(child);
      if (child.type === 'JSXElement') {
        return textComponents.has(getJSXElementName(child));
      }
      if (child.type !== 'JSXExpressionContainer') return false;
      const expression = child.expression;
      if (expression.type === 'Literal') {
        return (
          typeof expression.value === 'string' ||
          typeof expression.value === 'number'
        );
      }
      return (
        TEXT_EXPRESSION_TYPES.has(expression.type) ||
        isConstantIdentifier(expression)
      );
    }

    /**
     * The layout of an element's children: what React finds at each index.
     * An unknown expression may render anything, so it matches any kind when
     * two layouts are compared.
     */
    function getLayout(element) {
      return element.children
        .filter((child) => !isWhitespace(child) && !isComment(child))
        .map((child) => {
          if (isTextChild(child)) return 'text';
          if (child.type === 'JSXElement') {
            return `<${getJSXElementName(child)}>`;
          }
          return null;
        });
    }

    function isSameLayout(a, b) {
      return (
        a.length === b.length &&
        a.every(
          (kind, index) =>
            kind === null || b[index] === null || kind === b[index]
        )
      );
    }

    function getKey(element) {
      const attribute = element.openingElement.attributes.find(
        (a) => a.type === 'JSXAttribute' && a.name.name === 'key'
      );
      if (!attribute || !attribute.value) return null;
      const value = attribute.value;
      if (value.type === 'Literal') return JSON.stringify(value.value);
      if (value.type === 'JSXExpressionContainer') {
        const expression = value.expression;
        if (expression.type === 'Literal') {
          return JSON.stringify(expression.value);
        }
        if (expression.type === 'Identifier') return `id:${expression.name}`;
      }
      return null;
    }

    /** The JSX elements `expression` may evaluate to, as far as we can see. */
    function getAlternatives(expression) {
      switch (expression.type) {
        case 'JSXElement':
          return [expression];
        case 'Identifier': {
          const constant = constants.get(expression.name);
          return constant && constant.type === 'JSXElement' ? [constant] : [];
        }
        case 'ConditionalExpression':
          return [
            ...getAlternatives(expression.consequent),
            ...getAlternatives(expression.alternate),
          ];
        case 'MemberExpression': {
          // ITEMS[i] or ITEMS[i].property
          let property = null;
          let indexed = expression;
          if (!indexed.computed && indexed.property.type === 'Identifier') {
            property = indexed.property.name;
            indexed = indexed.object;
          }
          if (
            indexed.type !== 'MemberExpression' ||
            !indexed.computed ||
            indexed.object.type !== 'Identifier'
          ) {
            return [];
          }
          const array = constants.get(indexed.object.name);
          if (!array || array.type !== 'ArrayExpression') return [];
          return array.elements.flatMap((item) => {
            if (!item) return [];
            if (!property) return item.type === 'JSXElement' ? [item] : [];
            if (item.type !== 'ObjectExpression') return [];
            const found = item.properties.find(
              (p) =>
                p.type === 'Property' &&
                !p.computed &&
                p.key.type === 'Identifier' &&
                p.key.name === property
            );
            return found && found.value.type === 'JSXElement'
              ? [found.value]
              : [];
          });
        }
        default:
          return [];
      }
    }

    function collectConstants(program) {
      for (const statement of program.body) {
        let declaration = null;
        if (statement.type === 'VariableDeclaration') {
          declaration = statement;
        } else if (
          statement.type === 'ExportNamedDeclaration' &&
          statement.declaration &&
          statement.declaration.type === 'VariableDeclaration'
        ) {
          declaration = statement.declaration;
        }
        if (!declaration) continue;
        for (const declarator of declaration.declarations) {
          if (
            declarator.id.type === 'Identifier' &&
            declarator.init &&
            (declarator.init.type === 'ArrayExpression' ||
              declarator.init.type === 'JSXElement')
          ) {
            constants.set(declarator.id.name, declarator.init);
          }
        }
      }
    }

    return {
      Program: collectConstants,

      JSXExpressionContainer(node) {
        if (
          !node.parent ||
          (node.parent.type !== 'JSXElement' &&
            node.parent.type !== 'JSXFragment')
        ) {
          return;
        }

        const byName = new Map();
        for (const element of getAlternatives(node.expression)) {
          const name = getJSXElementName(element);
          if (!byName.has(name)) byName.set(name, []);
          byName.get(name).push(element);
        }

        for (const elements of byName.values()) {
          if (elements.length < 2) continue;
          const layouts = elements.map(getLayout);
          if (!layouts.some((layout) => layout.includes('text'))) continue;
          const differ = layouts.some((a) =>
            layouts.some((b) => !isSameLayout(a, b))
          );
          if (!differ) continue;
          const keys = elements.map(getKey);
          if (keys.every(Boolean) && new Set(keys).size === keys.length) {
            continue;
          }
          context.report({ node, messageId: 'unkeyed-swap' });
        }
      },
    };
  },
};
