/**
 * @fileoverview ESLint plugin to ensure Google Translate doesn't cause browser errors when used with a React application.
 * @author alistair-coup
 */
'use strict';

const plugin = {
  meta: {
    name: 'eslint-plugin-react-google-translate',
    version: '1.0.2',
  },
  configs: {},
  rules: {
    'no-conditional-text-nodes-with-siblings': require('./rules/no-conditional-text-nodes-with-siblings'),
    'no-return-text-nodes': require('./rules/no-return-text-nodes'),
  },
};

plugin.configs.recommended = {
  plugins: { 'react-google-translate': plugin },
  rules: {
    'react-google-translate/no-conditional-text-nodes-with-siblings': 'error',
    'react-google-translate/no-return-text-nodes': 'error',
  },
};

module.exports = plugin;
