import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default defineConfig([
  globalIgnores([".private/**", "output/**", "node_modules/**"]),
  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
  },
  {
    files: ["src/**/*.mjs", "test/**/*.mjs", "*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["web/**/*.js", "test/browser/**/*.mjs"],
    languageOptions: { globals: globals.browser },
  },
  prettier,
]);
