'use strict';

var loadConfig = require('load-config-file');

// loadConfig.register('.json', JSON.parse);
loadConfig.register(['.json', '.js'], function(ctx, opt, file) {
  return require(file);
});

module.exports = loadConfig;
