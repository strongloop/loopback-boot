// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
var boot = require('../');
var async = require('async');
var exportBrowserifyToFile = require('./helpers/browserify').exportToSandbox;
var fs = require('fs');
var path = require('path');
var expect = require('chai').expect;
var browserify = require('browserify');
var sandbox = require('./helpers/sandbox');
var vm = require('vm');
var createBrowserLikeContext = require('./helpers/browser').createContext;
var printContextLogs = require('./helpers/browser').printContextLogs;

describe('browser support for multiple apps', function() {
  this.timeout(60000); // 60s to give browserify enough time to finish

  beforeEach(sandbox.reset);

  it('has API for bundling and booting multiple apps', function(done) {
    var app1Dir = path.resolve(__dirname, './fixtures/browser-app');
    var app2Dir = path.resolve(__dirname, './fixtures/browser-app-2');

    var apps = [
      {
        appDir: app1Dir,
        appFile: './app.js',
        moduleName: 'browser-app',
      },
      {
        appDir: app2Dir,
        appFile: './app.js',
        moduleName: 'browser-app2',
        appId: 'browserApp2',
      },
    ];

    browserifyTestApps(apps, function(err, bundlePath) {
      if (err) return done(err);

      var bundledApps = executeBundledApps(bundlePath, apps, function(err) {
        var app1 = bundledApps.defaultApp;
        var app2 = bundledApps.browserApp2;

        expect(app1.settings).to.have.property('custom-key', 'custom-value');
        expect(Object.keys(app1.models)).to.include('Customer');
        expect(Object.keys(app1.models)).to.not.include('Robot');
        expect(app1.models.Customer.settings).to.have.property('_customized',
          'Customer');

        expect(Object.keys(app2.models)).to.include('Robot');
        expect(Object.keys(app2.models)).to.not.include('Customer');

        done();
      });
    });
  });
});

function browserifyTestApps(apps, next) {
  var b = browserify({
    debug: true,
    basedir: path.resolve(__dirname, './fixtures'),
  });

  var bundles = [];
  for (var i in apps) {
    var appDir = apps[i].appDir;
    var appFile = apps[i].appFile;
    var moduleName = apps[i].moduleName;
    var appId = apps[i].appId;

    appFile = path.join(appDir, appFile);
    b.require(appFile, {expose: moduleName});

    var opts = appDir;
    if (appId) {
      opts = {
        appId: appId,
        appRootDir: appDir,
      };
    }
    bundles.push(opts);
  }
  async.eachSeries(bundles, function(opts, done) {
    boot.compileToBrowserify(opts, b, done);
  }, function(err) {
    exportBrowserifyToFile(b, 'browser-app-bundle.js', next);
  });
}

function executeBundledApps(bundlePath, apps, done) {
  var code = fs.readFileSync(bundlePath);
  var context = createBrowserLikeContext();
  vm.runInContext(code, context, bundlePath);

  var ids = [];
  var script = 'var apps = {};\n';
  for (var i in apps) {
    var moduleName = apps[i].moduleName;
    var id = apps[i].appId || 'defaultApp';
    ids.push(id);
    script += 'apps.' + id + ' = require("' + moduleName + '");\n';
  }
  script += 'apps;\n';

  var appsInContext = vm.runInContext(script, context);
  async.each(ids, function(id, done) {
    appsInContext[id].once('booted', function() {
      done();
    });
  }, function(err) {
    printContextLogs(context);
    done(err, appsInContext);
  });

  return appsInContext;
}
