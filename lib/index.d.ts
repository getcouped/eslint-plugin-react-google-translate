import type { ESLint, Linter, Rule } from 'eslint';

declare const plugin: ESLint.Plugin & {
  meta: {
    name: string;
    version: string;
  };
  rules: {
    'no-conditional-text-nodes-with-siblings': Rule.RuleModule;
    'no-return-text-nodes': Rule.RuleModule;
  };
  configs: {
    recommended: Linter.Config;
  };
};

export = plugin;
