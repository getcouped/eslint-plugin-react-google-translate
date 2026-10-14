'use strict';

/**
 * Runs every `*.test.js` file of this directory. ESLint's `RuleTester`
 * executes its cases synchronously and throws on the first failing one,
 * so a test file that loads without throwing has passed.
 */
const fs = require('node:fs');
const path = require('node:path');

const files = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith('.test.js'))
  .sort();

let failed = false;
for (const file of files) {
  try {
    require(path.join(__dirname, file));
    console.log(`ok   ${file}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${file}\n`);
    console.error(error);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`\n${files.length} test file(s) passed`);
}
