/* global __dirname, require, module*/
const webpack = require('webpack');
const path = require('path');
const env = require('yargs').argv.env; // use --env with webpack 2
const pkg = require('./package.json');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const showBundle = false;
let plugins = [new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)];

if (showBundle) {
  plugins.push(new BundleAnalyzerPlugin());
}
let libraryName = pkg.name;

let outputFile, minimize;

if (env === 'build') {
  minimize = true;
  outputFile = libraryName + '.min.js';
} else {
  minimize = false;
  outputFile = libraryName + '.js';
}

const config = {
  mode: 'production',
  entry: __dirname + '/src/index.js',
  devtool: 'source-map',
  output: {
    path: __dirname + '/lib',
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true,
    globalObject: 'this'
  },
  optimization: {
    minimize: minimize
  },
  module: {
    rules: [
      {
        test: /(\.jsx|\.js)$/,
        loader: 'babel-loader',
        exclude: /(node_modules|bower_components)/,
        options: {
          plugins: ['lodash'],
          presets: [['env', { modules: false, targets: { node: 4 } }]]
        }
      },
      /*
        {
          test: /(\.jsx|\.js)$/,
          loader: 'eslint-loader',
          exclude: /node_modules/
        }
        */
    ]
  },
  plugins: plugins,
  resolve: {
    modules: [path.resolve('./node_modules'), path.resolve('./src')],
    extensions: ['.json', '.js'],
    alias: {
      'formio-export': path.resolve(__dirname, 'src/')
    }
  },
  externals: {
    lodash: {
      commonjs: 'lodash',
      commonjs2: 'lodash',
      amd: '_',
      root: '_'
    },
    axios: 'axios'
  },
  node: {
    // prevent webpack from injecting mocks to Node native modules
    // that does not make sense for the client
    dgram: 'empty',
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  }
};

module.exports = config;
