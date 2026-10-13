import js from "@eslint/js";
import { recommended as titan } from "@titan-design/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const TS = ["**/*.{ts,tsx}"];
const TESTS = ["**/test/**", "**/*.test.{ts,tsx}"];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.expo/**",
      "**/ios/**",
      "**/android/**",
      "**/*.config.{js,ts,mjs}",
      ".codewatch/**",
    ],
  },
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  titan,
  { files: TESTS, rules: { "titan/max-function-lines": "off" } },
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ["apps/controller/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, "react-hooks/exhaustive-deps": "error" },
  },
  {
    files: TS,
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // An expression-bodied effect returns the call's value as its cleanup ("destroy is not a function").
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression.arguments:first-child[body.type='CallExpression']",
          message: "An expression-bodied effect returns its value as the cleanup. Use a block body.",
        },
      ],
    },
  },
  {
    files: TS,
    ignores: TESTS,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true, ignoreVoidOperator: true },
      ],
      // stop/run_stop sends must never float silently.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
);
