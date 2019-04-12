var nodeExternals = require('webpack-node-externals');
const path = require('path');
const Dotenv = require('dotenv-webpack');

module.exports = {
  mode: 'development',
  output: {
    // use absolute paths in sourcemaps (important for debugging via IDE)
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    devtoolFallbackModuleFilenameTemplate: '[absolute-resource-path]?[hash]'
  },
  resolve: {
    modules: [path.resolve('./src')]
  },
  target: 'node', // webpack should compile node compatible code
  externals: [nodeExternals()], // in order to ignore all modules in node_modules folder
  devtool: 'inline-cheap-module-source-map',
  plugins: [new Dotenv()]
};
