import baseConfig from "./base.js";

/** @type {import("typescript-eslint").ConfigArray} */
export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // Node-specific: prefer async/await over raw promise chains
      "@typescript-eslint/promise-function-async": "error",
    },
  },
];
