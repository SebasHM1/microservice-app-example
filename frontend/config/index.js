const path = require('path');
const loadEnvVariablesFromDB = require('./load-env');

console.log('AUTH_API_ADDRESS:', process.env.AUTH_API_ADDRESS);
console.log('TODOS_API_ADDRESS:', process.env.TODOS_API_ADDRESS);
console.log('ZIPKIN_URL:', process.env.ZIPKIN_URL);

module.exports = {
  build: {
    env: require('./prod.env'),
    index: path.resolve(__dirname, '../dist/index.html'),
    assetsRoot: path.resolve(__dirname, '../dist'),
    assetsSubDirectory: 'static',
    assetsPublicPath: '/',
    productionSourceMap: true,
    productionGzip: false,
    productionGzipExtensions: ['js', 'css'],
    bundleAnalyzerReport: process.env.npm_config_report
  },
  dev: {
    loadEnvVariablesFromDB,
    env: require('./dev.env'),
    port: process.env.PORT,
    autoOpenBrowser: false,
    assetsSubDirectory: 'static',
    assetsPublicPath: '/',
    proxyTable: {
      '/login': {
        target: process.env.AUTH_API_ADDRESS || 'http://default-auth-api-address',
        secure: false,
      },
      '/todos': {
        target: process.env.TODOS_API_ADDRESS || 'http://default-todos-api-address',
        secure: false,
      },
      '/zipkin': {
        target: process.env.ZIPKIN_URL || 'http://default-zipkin-url',
        pathRewrite: {
          '^/zipkin': '',
        },
        secure: false,
      },
    },
    cssSourceMap: false
  }
};
