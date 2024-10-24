const globals = require("globals");
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const stylisticTs = require("@stylistic/eslint-plugin-ts");

module.exports = tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/release/**",
      "eslint.config.js",
      "jest.config.js"
    ]
  },
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "@stylistic/ts": stylisticTs
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.es2020,
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      "@stylistic/ts/semi": ["error"],
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "always" }
      ],
      "@typescript-eslint/no-inferrable-types": [
        "error",
        { ignoreParameters: true, ignoreProperties: true }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  },
  {
    files: ["src/renderer/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser
      }
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node
      }
    }
  }
);
