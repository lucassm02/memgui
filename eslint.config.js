import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: [
      "node_modules",
      "dist",
      "release",
      "public",
      "coverage",
      ".vscode",
      "eslint.config.js",
      "tailwind.config.js",
      "vite.config.js"
    ]
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    plugins: {
      react,
      import: importPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      prettier,
      "@typescript-eslint": tseslint
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "off",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "prettier/prettier": [
        "error",
        {
          tabWidth: 2,
          useTabs: false,
          endOfLine: "lf"
        }
      ],
      "react/jsx-no-target-blank": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true }
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "import/order": [
        "error",
        {
          alphabetize: { order: "asc", caseInsensitive: true }
        }
      ]
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["./src/api/tsconfig.json", "./src/ui/tsconfig.json"],
        tsconfigRootDir: process.cwd()
      }
    }
  }
];
