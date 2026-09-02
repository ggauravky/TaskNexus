module.exports = {
  root: true,
  env: { node: true, es2022: true, jest: true },
  extends: ["eslint:recommended"],
  ignorePatterns: ["node_modules/", ".local-data/", "coverage/"],
  parserOptions: { ecmaVersion: "latest" },
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    "no-useless-catch": "off",
  },
};
