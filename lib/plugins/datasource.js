// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const util = require('util');
const utils = require('../utils');
const PluginBase = require('../plugin-base');
const debug = require('debug')('loopback:boot:datasource');

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
  const app = context.app;
  const self = this;
  const lazyConnect = process.env.LB_LAZYCONNECT_DATASOURCES;
  utils.forEachKeyedObject(context.instructions[this.name], function(key, obj) {
    obj = self.getUpdatedConfigObject(context, obj, {useEnvVars: true});
    debug('Registering data source %s %j', key, obj);
    if (lazyConnect) {
      obj.lazyConnect =
        lazyConnect === 'false' || lazyConnect === '0' ? false : true;
    }
    app.dataSource(key, obj);
  });
};

