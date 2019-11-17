// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const boot = require('../');
const async = require('async');
const exportBrowserifyToFile = require('./helpers/browserify').exportToSandbox;
const packageFilter = require('./helpers/browserify').packageFilter;
const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;
const browserify = require('browserify');
const sandbox = require('./helpers/sandbox');
const vm = require('vm');
const createBrowserLikeContext = require('./helpers/browser').createContext;
const printContextLogs = require('./helpers/browser').printContextLogs;

describe('browser support for multiple apps', function() {
  this.timeout(60000); // 60s to give browserify enough time to finish

  beforeEach(sandbox.reset);

  it('has API for bundling and booting multiple apps', function(done) {
    const app1Dir = path.resolve(__dirname, './fixtures/browser-app');
    const app2Dir = path.resolve(__dirname, './fixtures/browser-app-2');

    const apps = [
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

      const bundledApps = executeBundledApps(bundlePath, apps, function(err) {
        const app1 = bundledApps.defaultApp;
        const app2 = bundledApps.browserApp2;

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
  const b = browserify({
    debug: true,
    basedir: path.resolve(__dirname, './fixtures'),
    packageFilter,
  });

  const bundles = [];
  for (const i in apps) {
    const appDir = apps[i].appDir;
    let appFile = apps[i].appFile;
    const moduleName = apps[i].moduleName;
    const appId = apps[i].appId;

    appFile = path.join(appDir, appFile);
    b.require(appFile, {expose: moduleName});

    let opts = appDir;
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
  const code = fs.readFileSync(bundlePath);
  const context = createBrowserLikeContext();
  vm.runInContext(code, context, bundlePath);

  const ids = [];
  let script = 'var apps = {};\n';
  for (const i in apps) {
    const moduleName = apps[i].moduleName;
    const id = apps[i].appId || 'defaultApp';
    ids.push(id);
    script += 'apps.' + id + ' = require("' + moduleName + '");\n';
  }
  script += 'apps;\n';

  const appsInContext = vm.runInContext(script, context);
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
