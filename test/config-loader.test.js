// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var configLoader = require('../lib/config-loader');
var fs = require('fs-extra');
var path = require('path');
var expect = require('chai').expect;
var sandbox = require('./helpers/sandbox');
var appdir = require('./helpers/appdir');

describe('config-loader', function() {
  beforeEach(sandbox.reset);
  beforeEach(appdir.init);

  it('does not cache loaded values', function() {
    appdir.createConfigFilesSync();
    appdir.writeConfigFileSync('middleware.json', {
      'strong-error-handler': { params: { debug: false }},
    });
    appdir.writeConfigFileSync('middleware.development.json', {
      'strong-error-handler': { params: { debug: true }},
    });

    // Here we load main config and merge it with DEV overrides
    var config = configLoader.loadMiddleware(appdir.PATH, 'development');
    expect(config['strong-error-handler'].params.debug, 'debug in development')
      .to.equal(true);

    // When we load the config file again in different environment,
    // only the main file is loaded and no overrides are applied.
    config = configLoader.loadMiddleware(appdir.PATH, 'production');
    expect(config['strong-error-handler'].params.debug, 'debug in production')
      .to.equal(false);
  });
});
