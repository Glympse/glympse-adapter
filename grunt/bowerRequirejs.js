// Automagically wire-up installed Bower components into your RequireJS config
module.exports = {
  target: {
    rjsConfig: '<%= config.app %>/src/requireConfig.js'
  },
  options: {
    exclude: ['requirejs', 'almond']
  }
};
