var boot = require('../');
var fs = require('fs-extra');
var extend = require('util')._extend;
var path = require('path');
var loopback = require('loopback');
var assert = require('assert');
var expect = require('must');
var sandbox = require('./helpers/sandbox');

var SIMPLE_APP = path.join(__dirname, 'fixtures', 'simple-app');

var appDir;

describe('bootLoopBackApp', function() {
  beforeEach(sandbox.reset);

  beforeEach(function makeUniqueAppDir(done) {
    // Node's module loader has a very aggressive caching, therefore
    // we can't reuse the same path for multiple tests
    // The code here is used to generate a random string
    require('crypto').randomBytes(5, function(ex, buf) {
      var randomStr = buf.toString('hex');
      appDir = sandbox.resolve(randomStr);
      done();
    });
  });

  describe('from options', function () {
    var app;
    beforeEach(function () {
      app = loopback();
      boot(app, {
        app: {
          port: 3000,
          host: '127.0.0.1',
          restApiRoot: '/rest-api',
          foo: {bar: 'bat'},
          baz: true
        },
        models: {
          'foo-bar-bat-baz': {
            options: {
              plural: 'foo-bar-bat-bazzies'
            },
            dataSource: 'the-db'
          }
        },
        dataSources: {
          'the-db': {
            connector: 'memory',
            defaultForType: 'db'
          }
        }
      });
    });

    it('should have port setting', function () {
      assert.equal(app.get('port'), 3000);
    });

    it('should have host setting', function() {
      assert.equal(app.get('host'), '127.0.0.1');
    });

    it('should have restApiRoot setting', function() {
      assert.equal(app.get('restApiRoot'), '/rest-api');
    });

    it('should have other settings', function () {
      expect(app.get('foo')).to.eql({
        bar: 'bat'
      });
      expect(app.get('baz')).to.eql(true);
    });

    it('Instantiate models', function () {
      assert(app.models);
      assert(app.models.FooBarBatBaz);
      assert(app.models.fooBarBatBaz);
      assertValidDataSource(app.models.FooBarBatBaz.dataSource);
      assert.isFunc(app.models.FooBarBatBaz, 'find');
      assert.isFunc(app.models.FooBarBatBaz, 'create');
    });

    it('Attach models to data sources', function () {
      assert.equal(app.models.FooBarBatBaz.dataSource, app.dataSources.theDb);
    });

    it('Instantiate data sources', function () {
      assert(app.dataSources);
      assert(app.dataSources.theDb);
      assertValidDataSource(app.dataSources.theDb);
      assert(app.dataSources.TheDb);
    });

    describe('boot and models directories', function() {
      beforeEach(function() {
        boot(app, SIMPLE_APP);
      });

      it('should run all modules in the boot directory', function () {
        assert(process.loadedFooJS);
        delete process.loadedFooJS;
      });

      it('should run all modules in the models directory', function () {
        assert(process.loadedBarJS);
        delete process.loadedBarJS;
      });
    });

    describe('PaaS and npm env variables', function() {
      function bootWithDefaults() {
        app = loopback();
        boot(app, {
          app: {
            port: undefined,
            host: undefined
          }
        });
      }

      it('should be honored', function() {
        function assertHonored(portKey, hostKey) {
          process.env[hostKey] = randomPort();
          process.env[portKey] = randomHost();
          bootWithDefaults();
          assert.equal(app.get('port'), process.env[portKey]);
          assert.equal(app.get('host'), process.env[hostKey]);
          delete process.env[portKey];
          delete process.env[hostKey];
        }

        assertHonored('OPENSHIFT_SLS_PORT', 'OPENSHIFT_NODEJS_IP');
        assertHonored('npm_config_port', 'npm_config_host');
        assertHonored('npm_package_config_port', 'npm_package_config_host');
        assertHonored('OPENSHIFT_SLS_PORT', 'OPENSHIFT_SLS_IP');
        assertHonored('PORT', 'HOST');
      });

      it('should be honored in order', function() {
        /*jshint camelcase:false */
        process.env.npm_config_host = randomHost();
        process.env.OPENSHIFT_SLS_IP = randomHost();
        process.env.OPENSHIFT_NODEJS_IP = randomHost();
        process.env.HOST = randomHost();
        process.env.npm_package_config_host = randomHost();

        bootWithDefaults();
        assert.equal(app.get('host'), process.env.npm_config_host);

        delete process.env.npm_config_host;
        delete process.env.OPENSHIFT_SLS_IP;
        delete process.env.OPENSHIFT_NODEJS_IP;
        delete process.env.HOST;
        delete process.env.npm_package_config_host;

        process.env.npm_config_port = randomPort();
        process.env.OPENSHIFT_SLS_PORT = randomPort();
        process.env.OPENSHIFT_NODEJS_PORT = randomPort();
        process.env.PORT = randomPort();
        process.env.npm_package_config_port = randomPort();

        bootWithDefaults();
        assert.equal(app.get('host'), process.env.npm_config_host);
        assert.equal(app.get('port'), process.env.npm_config_port);

        delete process.env.npm_config_port;
        delete process.env.OPENSHIFT_SLS_PORT;
        delete process.env.OPENSHIFT_NODEJS_PORT;
        delete process.env.PORT;
        delete process.env.npm_package_config_port;
      });

      function randomHost() {
        return Math.random().toString().split('.')[1];
      }

      function randomPort() {
        return Math.floor(Math.random() * 10000);
      }

      it('should honor 0 for free port', function () {
        boot(app, {app: {port: 0}});
        assert.equal(app.get('port'), 0);
      });

      it('should default to port 3000', function () {
        boot(app, {app: {port: undefined}});
        assert.equal(app.get('port'), 3000);
      });
    });
  });

  describe('from directory', function () {
    it('Load config files', function () {
      var app = loopback();

      boot(app, SIMPLE_APP);

      assert(app.models.foo);
      assert(app.models.Foo);
      assert(app.models.Foo.dataSource);
      assert.isFunc(app.models.Foo, 'find');
      assert.isFunc(app.models.Foo, 'create');
    });

    it('merges datasource configs from multiple files', function() {
      givenAppInSandbox();

      writeAppConfigFile('datasources.local.json', {
        db: { local: 'applied' }
      });

      var env = process.env.NODE_ENV || 'development';
      writeAppConfigFile('datasources.' + env + '.json', {
        db: { env: 'applied' }
      });

      var app = loopback();
      boot(app, appDir);

      var db = app.datasources.db.settings;
      expect(db).to.have.property('local', 'applied');
      expect(db).to.have.property('env', 'applied');

      var expectedLoadOrder = ['local', 'env'];
      var actualLoadOrder = Object.keys(db).filter(function(k) {
        return expectedLoadOrder.indexOf(k) !== -1;
      });

      expect(actualLoadOrder, 'load order').to.eql(expectedLoadOrder);
    });

    it('supports .js for custom datasource config files', function() {
      givenAppInSandbox();
      fs.writeFileSync(
        path.resolve(appDir, 'datasources.local.js'),
        'module.exports = { db: { fromJs: true } };');

      var app = loopback();
      boot(app, appDir);

      var db = app.datasources.db.settings;
      expect(db).to.have.property('fromJs', true);
    });

    it('refuses to merge Object properties', function() {
      givenAppInSandbox();
      writeAppConfigFile('datasources.local.json', {
        db: { nested: { key: 'value' } }
      });

      var app = loopback();
      expect(function() { boot(app, appDir); })
        .to.throw(/`nested` is not a value type/);
    });

    it('refuses to merge Array properties', function() {
      givenAppInSandbox();
      writeAppConfigFile('datasources.local.json', {
        db: { nested: ['value'] }
      });

      var app = loopback();
      expect(function() { boot(app, appDir); })
        .to.throw(/`nested` is not a value type/);
    });

    it('merges app configs from multiple files', function() {
      givenAppInSandbox();

      writeAppConfigFile('app.local.json', { cfgLocal: 'applied' });

      var env = process.env.NODE_ENV || 'development';
      writeAppConfigFile('app.' + env + '.json', { cfgEnv: 'applied' });

      var app = loopback();
      boot(app, appDir);

      expect(app.settings).to.have.property('cfgLocal', 'applied');
      expect(app.settings).to.have.property('cfgEnv', 'applied');

      var expectedLoadOrder = ['cfgLocal', 'cfgEnv'];
      var actualLoadOrder = Object.keys(app.settings).filter(function(k) {
        return expectedLoadOrder.indexOf(k) !== -1;
      });

      expect(actualLoadOrder, 'load order').to.eql(expectedLoadOrder);
    });

    it('supports .js for custom app config files', function() {
      givenAppInSandbox();
      fs.writeFileSync(
        path.resolve(appDir, 'app.local.js'),
        'module.exports = { fromJs: true };');

      var app = loopback();
      boot(app, appDir);

      expect(app.settings).to.have.property('fromJs', true);
    });
  });
});


function assertValidDataSource(dataSource) {
  // has methods
  assert.isFunc(dataSource, 'createModel');
  assert.isFunc(dataSource, 'discoverModelDefinitions');
  assert.isFunc(dataSource, 'discoverSchema');
  assert.isFunc(dataSource, 'enableRemote');
  assert.isFunc(dataSource, 'disableRemote');
  assert.isFunc(dataSource, 'defineOperation');
  assert.isFunc(dataSource, 'operations');
}

assert.isFunc = function (obj, name) {
  assert(obj, 'cannot assert function ' + name +
    ' on object that does not exist');
  assert(typeof obj[name] === 'function', name + ' is not a function');
};

function givenAppInSandbox(appConfig, dataSources, models) {
  fs.mkdirsSync(appDir);

  appConfig = extend({
  }, appConfig);
  writeAppConfigFile('app.json', appConfig);

  dataSources = extend({
    db: {
      connector: 'memory',
      defaultForType: 'db'
    }
  }, dataSources);
  writeAppConfigFile('datasources.json', dataSources);

  models = extend({
  }, models);
  writeAppConfigFile('models.json', models);
}

function writeAppConfigFile(name, json) {
  fs.writeJsonFileSync(path.resolve(appDir, name), json);
}
