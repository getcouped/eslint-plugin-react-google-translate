import type { ESLint, Linter, Rule } from 'eslint';

declare const plugin: ESLint.Plugin & {
  meta: {
    name: string;
    version: string;
  };
  rules: {
    'no-conditional-text-nodes-with-siblings': Rule.RuleModule;
    'no-return-text-nodes': Rule.RuleModule;
    'no-unkeyed-text-element-swap': Rule.RuleModule;
    'no-dynamic-sibling-before-text': Rule.RuleModule;
  };
  configs: {
    recommended: Linter.Config;
  };
};

export = plugin;
