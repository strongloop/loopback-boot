var util = require('util');
var utils = require('../utils');
var PluginBase = require('../plugin-base');
var debug = require('debug')('loopback:boot:datasource');

module.exports = function(options) {
  return new DataSource(options);
};

function DataSource(options) {
  PluginBase.call(this, options, 'dataSources', 'datasources');
}

util.inherits(DataSource, PluginBase);

DataSource.prototype.getRootDir = function() {
  return this.options.dsRootDir;
};

DataSource.prototype.start = function(context) {
  var app = context.app;
  var self = this;
  utils.forEachKeyedObject(context.instructions[this.name], function(key, obj) {
    obj = self.getUpdatedConfigObject(context, obj, { useEnvVars: true });
    debug('Registering data source %s %j', key, obj);
    app.dataSource(key, obj);
  });
};

