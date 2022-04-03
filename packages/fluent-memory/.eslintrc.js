module.exports = {
  ...require('@goatlab/eslint/eslint-server.js'),
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json'
  }
}
