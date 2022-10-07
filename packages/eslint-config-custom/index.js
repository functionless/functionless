module.exports = {
  env: {
    jest: true,
    node: true,
  },
  plugins: ["@typescript-eslint", "import", "no-only-tests"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    project: "./tsconfig.json",
    extraFileExtensions: [".json"],
  },
  extends: ["plugin:import/typescript"],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      node: {},
      typescript: {
        project: "./tsconfig.json",
        alwaysTryTypes: true,
      },
    },
  },
  rules: {
    "@typescript-eslint/no-require-imports": ["error"],
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: ["**/test/**"],
        optionalDependencies: false,
        peerDependencies: true,
      },
    ],
    "import/no-unresolved": ["error"],
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external"],
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
      },
    ],
    "no-duplicate-imports": ["error"],
    "no-shadow": ["off"],
    "@typescript-eslint/no-shadow": "off",
    "key-spacing": ["error"],
    "no-multiple-empty-lines": ["error"],
    "@typescript-eslint/no-floating-promises": ["error"],
    "no-return-await": ["off"],
    "@typescript-eslint/return-await": ["error"],
    "no-trailing-spaces": ["error"],
    "dot-notation": ["error"],
    "no-bitwise": ["error"],
    "@typescript-eslint/member-ordering": "off",
    quotes: "off",
    "comma-dangle": "off",
    "quote-props": "off",
    "@typescript-eslint/indent": "off",
    "brace-style": "off",
    "@typescript-eslint/explicit-member-accessibility": "off",
    "no-debugger": "error",
    "@typescript-eslint/explicit-member-accessibility": [
      "error",
      {
        accessibility: "explicit",
        overrides: {
          accessors: "explicit",
          constructors: "no-public",
          methods: "explicit",
          properties: "off",
          parameterProperties: "off",
        },
      },
    ],
    "no-only-tests/no-only-tests": [
      "error",
      {
        fix: true,
        block: ["test."],
      },
    ],
  },
  overrides: [
    {
      files: ["*.md"],
      extends: "plugin:markdown/recommended",
    },
    {
      files: ["*.js"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ],
};
