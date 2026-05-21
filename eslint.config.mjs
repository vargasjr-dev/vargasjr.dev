import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noMockInternalModules from "./eslint-rules/no-mock-internal-modules.js";
import importsAtTop from "./eslint-rules/imports-at-top.js";
import noInlineImports from "./eslint-rules/no-inline-imports.js";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
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
    },
  },
]);
