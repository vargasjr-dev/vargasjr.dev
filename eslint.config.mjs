import noMockInternalModules from "./eslint-rules/no-mock-internal-modules.js";
import importsAtTop from "./eslint-rules/imports-at-top.js";
import noInlineImports from "./eslint-rules/no-inline-imports.js";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "dist/**", ".git/**"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-console": "warn",
      "no-unused-vars": "off",
    },
  },
  {
    plugins: {
      custom: {
        rules: {
          "no-mock-internal-modules": noMockInternalModules,
          "imports-at-top": importsAtTop,
          "no-inline-imports": noInlineImports,
        },
      },
    },
    rules: {
      "custom/imports-at-top": "error",
      "custom/no-inline-imports": "error",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.js", "**/*.spec.ts", "**/*.spec.js"],
    rules: {
      "custom/no-mock-internal-modules": "error",
      "no-console": "off",
    },
  },
];

export default eslintConfig;
