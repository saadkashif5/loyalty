import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

// One config for every workspace. `mobile` is outside the npm workspaces and
// is linted separately once it is revived (see ROADMAP.md Phase 6).
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "mobile/**",
      "loadtests/**",
      "web/next-env.d.ts",
      "admin/next-env.d.ts",
      "portal/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Logs go through pino so they stay structured and free of PII (§45).
      "no-console": "error",
    },
  },
  {
    files: ["web/**/*.{ts,tsx}", "admin/**/*.{ts,tsx}", "portal/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Scripts and tests print to the terminal on purpose.
    files: ["api/src/scripts/**", "api/tests/**"],
    rules: { "no-console": "off" },
  },
  prettier,
);
