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
      // React Native: hooks rules enforced via react-hooks plugin (added per-app)
      "@typescript-eslint/promise-function-async": "error",
    },
  },
];
