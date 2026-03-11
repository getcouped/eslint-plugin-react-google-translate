/**
 * @fileoverview ESLint plugin to ensure Google Translate doesn't cause browser errors when used with a React application.
 * @author alistair-coup
 */
'use strict';

module.exports.rules = {
  'no-conditional-text-nodes-with-siblings': require('./rules/no-conditional-text-nodes-with-siblings'),
  'no-return-text-nodes': require('./rules/no-return-text-nodes'),
};
