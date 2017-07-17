/*global module:false*/

module.exports = function(grunt)
{
  'use strict';

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Load grunt config
  require('load-grunt-config')(grunt, {
    init: true,
    data: {
      config: {
        // Configurable paths
        app: 'app',
        builds: 'builds',
        dist: 'dist',
        distExports: 'dist',
        moduleOut: 'glympse-adapter',
        moduleIn: 'GlympseAdapter',
        moduleVersion: '2.7.2'
      }
    }
  });
};
