var boot = require('../');
var exportBrowserifyToFile = require('./helpers/browserify').exportToSandbox;
var fs = require('fs');
var path = require('path');
var expect = require('chai').expect;
var browserify = require('browserify');
var sandbox = require('./helpers/sandbox');
var vm = require('vm');
var createBrowserLikeContext = require('./helpers/browser').createContext;
var printContextLogs = require('./helpers/browser').printContextLogs;

var compileStrategies = {
  'default': function(appDir) {
    var b = browserify({
      basedir: appDir,
      debug: true
    });

    b.require('./app.js', { expose: 'browser-app' });
    return b;
  },

  'coffee': function(appDir) {
    var b = browserify({
      basedir: appDir,
      extensions: ['.coffee'],
      debug: true
    });

    b.transform('coffeeify');

    b.require('./app.coffee', { expose: 'browser-app' });
    return b;
  },
};

describe('browser support', function() {
  this.timeout(60000); // 60s to give browserify enough time to finish

  beforeEach(sandbox.reset);

  it('has API for bundling and executing boot instructions', function(done) {
    var appDir = path.resolve(__dirname, './fixtures/browser-app');

    browserifyTestApp(appDir, function(err, bundlePath) {
      if (err) return done(err);

      var app = executeBundledApp(bundlePath);

      // configured in fixtures/browser-app/boot/configure.js
      expect(app.settings).to.have.property('custom-key', 'custom-value');
      expect(Object.keys(app.models)).to.include('Customer');
      expect(app.models.Customer.settings)
        .to.have.property('_customized', 'Customer');

      // configured in fixtures/browser-app/component-config.json
      // and fixtures/browser-app/components/dummy-component.js
      expect(app.dummyComponentOptions).to.eql({ option: 'value' });

      done();
    });
  });

  it('loads mixins', function(done) {
    var appDir = path.resolve(__dirname, './fixtures/browser-app');
    var options = {
      appRootDir: appDir
    };

    browserifyTestApp(options, function(err, bundlePath) {
      if (err) return done(err);

      var app = executeBundledApp(bundlePath);

      var modelBuilder = app.registry.modelBuilder;
      var registry = modelBuilder.mixins.mixins;
      expect(Object.keys(registry)).to.eql(['TimeStamps']);
      expect(app.models.Customer.timeStampsMixin).to.eql(true);

      done();
    });
  });

  it('supports coffee-script files', function(done) {
    // add coffee-script to require.extensions
    require('coffee-script/register');

    var appDir = path.resolve(__dirname, './fixtures/coffee-app');

    browserifyTestApp(appDir, 'coffee', function(err, bundlePath) {
      if (err) return done(err);

      var app = executeBundledApp(bundlePath);

      // configured in fixtures/browser-app/boot/configure.coffee
      expect(app.settings).to.have.property('custom-key', 'custom-value');
      expect(Object.keys(app.models)).to.include('Customer');
      expect(app.models.Customer.settings)
        .to.have.property('_customized', 'Customer');
      done();
    });
  });
});

function browserifyTestApp(options, strategy, next) {
  // set default args
  if (((typeof strategy) === 'function') && !next) {
    next = strategy;
    strategy = undefined;
  }
  if (!strategy)
    strategy = 'default';

  var appDir = typeof(options) === 'object' ? options.appRootDir : options;
  var b = compileStrategies[strategy](appDir);

  boot.compileToBrowserify(options, b);

  exportBrowserifyToFile(b, 'browser-app-bundle.js', next);
}

function executeBundledApp(bundlePath) {
  var code = fs.readFileSync(bundlePath);
  var context = createBrowserLikeContext();
  vm.runInContext(code, context, bundlePath);
  var app = vm.runInContext('require("browser-app")', context);

  printContextLogs(context);

  return app;
}
