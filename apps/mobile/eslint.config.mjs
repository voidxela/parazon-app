import reactNativeConfig from "@parazon/eslint-config/react-native";

/** @type {import("typescript-eslint").ConfigArray} */
export default [
  {
    ignores: ["node_modules/", "dist/", ".expo/", "babel.config.js"],
  },
  ...reactNativeConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
