// Copyright IBM Corp. 2014,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const boot = require('../');
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

const compileStrategies = {
  default: function(appDir) {
    const b = browserify({
      basedir: appDir,
      debug: true,
      packageFilter,
    });
    b.require('./app.js', {expose: 'browser-app'});
    return b;
  },

  coffee: function(appDir) {
    const b = browserify({
      basedir: appDir,
      extensions: ['.coffee'],
      debug: true,
      packageFilter,
    });
    b.transform('coffeeify');

    b.require('./app.coffee', {expose: 'browser-app'});
    return b;
  },
};

describe('browser support', function() {
  this.timeout(60000); // 60s to give browserify enough time to finish

  beforeEach(sandbox.reset);

  it('has API for bundling and executing boot instructions', function(done) {
    const appDir = path.resolve(__dirname, './fixtures/browser-app');

    browserifyTestApp(appDir, function(err, bundlePath) {
      if (err) return done(err);

      const app = executeBundledApp(bundlePath, function(err) {
        if (err) return done(err);
        // configured in fixtures/browser-app/boot/configure.js
        expect(app.settings).to.have.property('custom-key', 'custom-value');
        expect(Object.keys(app.models)).to.include('Customer');
        expect(app.models.Customer.settings).to.have.property(
          '_customized',
          'Customer',
        );

        // configured in fixtures/browser-app/component-config.json
        // and fixtures/browser-app/components/dummy-component.js
        expect(app.dummyComponentOptions).to.eql({option: 'value'});
        done();
      });
    });
  });

  it('loads mixins', function(done) {
    const appDir = path.resolve(__dirname, './fixtures/browser-app');
    const options = {
      appRootDir: appDir,
    };

    browserifyTestApp(options, function(err, bundlePath) {
      if (err) return done(err);

      const app = executeBundledApp(bundlePath, function(err) {
        const modelBuilder = app.registry.modelBuilder;
        const registry = modelBuilder.mixins.mixins;
        expect(Object.keys(registry)).to.eql(['TimeStamps']);
        expect(app.models.Customer.timeStampsMixin).to.eql(true);

        done();
      });
    });
  });

  it('supports coffee-script files', function(done) {
    // add coffee-script to require.extensions
    require('coffeescript/register');

    const appDir = path.resolve(__dirname, './fixtures/coffee-app');

    browserifyTestApp(appDir, 'coffee', function(err, bundlePath) {
      if (err) return done(err);

      const app = executeBundledApp(bundlePath, function(err) {
        // configured in fixtures/browser-app/boot/configure.coffee
        expect(app.settings).to.have.property('custom-key', 'custom-value');
        expect(Object.keys(app.models)).to.include('Customer');
        expect(app.models.Customer.settings).to.have.property(
          '_customized',
          'Customer',
        );
        done();
      });
    });
  });
});

function browserifyTestApp(options, strategy, next) {
  // set default args
  if (typeof strategy === 'function' && !next) {
    next = strategy;
    strategy = undefined;
  }
  if (!strategy) strategy = 'default';

  const appDir = typeof options === 'object' ? options.appRootDir : options;
  const b = compileStrategies[strategy](appDir);

  boot.compileToBrowserify(options, b, function(err) {
    exportBrowserifyToFile(b, 'browser-app-bundle.js', next);
  });
}

function executeBundledApp(bundlePath, done) {
  const code = fs.readFileSync(bundlePath);
  const context = createBrowserLikeContext();
  vm.runInContext(code, context, bundlePath);
  const app = vm.runInContext('require("browser-app")', context);
  app.once('booted', function(err) {
    printContextLogs(context);
    done(err, app);
  });
  return app;
}
