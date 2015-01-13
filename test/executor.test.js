var boot = require('../');
var path = require('path');
var loopback = require('loopback');
var assert = require('assert');
var expect = require('must');
var sandbox = require('./helpers/sandbox');
var appdir = require('./helpers/appdir');

var SIMPLE_APP = path.join(__dirname, 'fixtures', 'simple-app');

var app;


describe('executor', function() {
  beforeEach(sandbox.reset);

  beforeEach(appdir.init);

  beforeEach(function() {
    app = loopback();
  });

  var dummyInstructions = someInstructions({
    app: {
      port: 3000,
      host: '127.0.0.1',
      restApiRoot: '/rest-api',
      foo: { bar: 'bat' },
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

  it('instantiates models', function() {
    boot.execute(app, dummyInstructions);
    assert(app.models);
    assert(app.models.FooBarBatBaz);
    assert(app.models.fooBarBatBaz);
    assertValidDataSource(app.models.FooBarBatBaz.dataSource);
    assert.isFunc(app.models.FooBarBatBaz, 'find');
    assert.isFunc(app.models.FooBarBatBaz, 'create');
  });

  it('attaches models to data sources', function() {
    boot.execute(app, dummyInstructions);
    assert.equal(app.models.FooBarBatBaz.dataSource, app.dataSources.theDb);
  });

  it('instantiates data sources', function() {
    boot.execute(app, dummyInstructions);
    assert(app.dataSources);
    assert(app.dataSources.theDb);
    assertValidDataSource(app.dataSources.theDb);
    assert(app.dataSources.TheDb);
  });

  describe('with boot and models files', function() {
    beforeEach(function() {
      boot.execute(app, simpleAppInstructions());
    });

    it('should run `boot/*` files', function() {
      assert(process.loadedFooJS);
      delete process.loadedFooJS;
    });

    it('should run `models/*` files', function() {
      assert(process.loadedBarJS);
      delete process.loadedBarJS;
    });
  });

  describe('with PaaS and npm env variables', function() {
    function bootWithDefaults() {
      app = loopback();
      boot.execute(app, someInstructions({
        app: {
          port: undefined,
          host: undefined
        }
      }));
    }

    it('should honor host and port', function() {
      function assertHonored(portKey, hostKey) {
        process.env[hostKey] = randomPort();
        process.env[portKey] = randomHost();
        bootWithDefaults();
        assert.equal(app.get('port'), process.env[portKey], portKey);
        assert.equal(app.get('host'), process.env[hostKey], hostKey);
        delete process.env[portKey];
        delete process.env[hostKey];
      }

      assertHonored('OPENSHIFT_SLS_PORT', 'OPENSHIFT_NODEJS_IP');
      assertHonored('npm_config_port', 'npm_config_host');
      assertHonored('npm_package_config_port', 'npm_package_config_host');
      assertHonored('OPENSHIFT_SLS_PORT', 'OPENSHIFT_SLS_IP');
      assertHonored('PORT', 'HOST');
    });

    it('should prioritize sources', function() {
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

    it('should honor 0 for free port', function() {
      boot.execute(app, someInstructions({ app: { port: 0 } }));
      assert.equal(app.get('port'), 0);
    });

    it('should default to port 3000', function() {
      boot.execute(app, someInstructions({ app: { port: undefined } }));
      assert.equal(app.get('port'), 3000);
    });
  });

  it('calls function exported by models/model.js', function() {
    var file = appdir.writeFileSync('models/model.js',
      'module.exports = function(app) { app.fnCalled = true; };');

    delete app.fnCalled;
    boot.execute(app, someInstructions({ files: { models: [ file ] } }));
    expect(app.fnCalled, 'exported fn was called').to.be.true();
  });

  it('calls function exported by boot/init.js', function() {
    var file = appdir.writeFileSync('boot/init.js',
      'module.exports = function(app) { app.fnCalled = true; };');

    delete app.fnCalled;
    boot.execute(app, someInstructions({ files: { boot: [ file ] } }));
    expect(app.fnCalled, 'exported fn was called').to.be.true();
  });

  it('throws on bad require() call inside model', function() {
    var file = appdir.writeFileSync('models/BadCustomer.js',
      'require("doesnt-exist"); module.exports = {};');

    function doBoot() {
      boot.execute(app, someInstructions({ files: { models: [ file ] } }));
    }

    expect(doBoot).to.throw(/Cannot find module \'doesnt-exist\'/);
  });

  it('does not call Model ctor exported by models/model.json', function() {
    var file = appdir.writeFileSync('models/model.js',
        'var loopback = require("loopback");\n' +
        'module.exports = loopback.Model.extend("foo");\n' +
        'module.exports.prototype._initProperties = function() {\n' +
        '  global.fnCalled = true;\n' +
        '};');

    delete global.fnCalled;
    boot.execute(app, someInstructions({ files: { models: [ file ] } }));
    expect(global.fnCalled, 'exported fn was called').to.be.undefined();
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

function someInstructions(values) {
  var result = {
    app: values.app || {},
    models: values.models || {},
    dataSources: values.dataSources || {},
    files: {
      models: [],
      boot: []
    }
  };

  if (values.files) {
    for (var k in values.files)
      result.files[k] = values.files[k];
  }

  return result;
}

function simpleAppInstructions() {
  return boot.compile(SIMPLE_APP);
}
