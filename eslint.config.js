const { defineConfig } = require("eslint/config");
const eslintJs = require("@eslint/js");
const jestPlugin = require("eslint-plugin-jest");
const lwcConfig = require("@salesforce/eslint-config-lwc/recommended");
const globals = require("globals");

module.exports = defineConfig([
  // LWC configuration
  {
    files: ["**/lwc/**/*.js"],
    extends: [lwcConfig]
  },

  // These components intentionally own cleared timers for debounced lookups,
  // delayed blur handling, or Flow auto-advance.
  {
    files: [
      "**/lwc/newtonSelectorFlowScreen/newtonSelectorFlowScreen.js",
      "**/lwc/newtonSelectorFlowCpeIconSelector/newtonSelectorFlowCpeIconSelector.js",
      "**/lwc/newtonSelectorDataSelector/newtonSelectorDataSelector.js"
    ],
    rules: {
      "@lwc/lwc/no-async-operation": "off"
    }
  },

  // LWC configuration with override for LWC test files
  {
    files: ["**/lwc/**/*.test.js"],
    extends: [lwcConfig],
    rules: {
      "@lwc/lwc/no-unexpected-wire-adapter-usages": "off"
    },
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },

  // Jest mocks configuration
  {
    files: ["**/jest-mocks/**/*.js"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...jestPlugin.environments.globals.globals
      }
    },
    plugins: {
      eslintJs
    },
    extends: ["eslintJs/recommended"]
  }
]);
