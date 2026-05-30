import nodeConfig from "@parazon/eslint-config/node";

export default [
  ...nodeConfig,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
