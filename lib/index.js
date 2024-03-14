/**
 * @fileoverview ESLint plugin to ensure Google Translate doesn&#39;t cause browser errors when used with a React application.
 * @author alistair-coup
 */
'use strict';

const requireIndex = require('requireindex');

// import all rules in lib/rules
module.exports.rules = requireIndex(__dirname + '/rules');
