module.exports = {
  root: true,
  parser: "babel-eslint",
  parserOptions: {
    sourceType: "module"
  },
  env: {
    browser: true
  },
  // https://github.com/feross/standard/blob/master/RULES.md#javascript-standard-style
  extends: ["standard"],
  // required to lint *.vue files
  plugins: ["html", "import"],
  globals: {
    XLSC: true,
    XLS: true,
    Connection: true,
    universalLinks: true,
    LocalFileSystem: true,
    cordova: true,
    html2pdf: true,
    DEV: true,
    PROD: true,
    __THEME: true,
    sms: true,
    logOb: true
  },
  // add your custom rules here
  rules: {
    // allow paren-less arrow functions
    "arrow-parens": 0,
    "one-var": 0,
    "import/first": 0,
    "import/named": 2,
    "import/namespace": 2,
    "import/default": 2,
    "import/export": 2,
    // allow debugger during development
    "no-debugger": process.env.NODE_ENV === "production" ? 2 : 0,
    "no-debugger": process.env.NODE_ENV === "production" ? 2 : 0,
    "no-mixed-spaces-and-tabs": [0],
    "no-tabs": 0,
    skipBlankLines: 0,
    ignoreComments: 0,
    "no-unreachable": 0,
    "no-unused-expressions": 0,
    "space-before-function-paren": 0,
    "no-trailing-spaces": [2, { skipBlankLines: true }],
    indent: 0,
    "no-multiple-empty-lines": 0,
    "brace-style": 0,
    "no-useless-return": 0,
    "no-unexpected-multiline": 0,
    "func-call-spacing": 0,
    quotes: 0,
    semi: 0,
    "operator-linebreak": 0,
    "no-new-func": 0,
    "comma-dangle": 0
  }
};
