module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off', // Allow any for mocks
    '@typescript-eslint/no-non-null-assertion': 'off',
    'no-console': 'off', // CLI tool needs console
  },
  ignorePatterns: ['dist/', 'node_modules/', 'python/', '*.js', '*.cjs'],
};