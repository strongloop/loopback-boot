var boot = require('../');
var path = require('path');
var loopback = require('loopback');
var assert = require('assert');
var expect = require('chai').expect;
var fs = require('fs-extra');
var sandbox = require('./helpers/sandbox');
var appdir = require('./helpers/appdir');
var supertest = require('supertest');

var SIMPLE_APP = path.join(__dirname, 'fixtures', 'simple-app');

var app;

describe('executor', function() {
  beforeEach(sandbox.reset);

  beforeEach(appdir.init);

  beforeEach(function() {
    app = loopback();

    // process.bootFlags is used by simple-app/boot/*.js scripts
    process.bootFlags = [];
  });

  afterEach(function() {
    delete process.bootFlags;
  });

  var dummyInstructions = someInstructions({
    config: {
      port: 3000,
      host: '127.0.0.1',
      restApiRoot: '/rest-api',
      foo: { bar: 'bat' },
      baz: true
    },
    models: [
      {
        name: 'User',
        config: {
          dataSource: 'the-db'
        }
      }
    ],
    dataSources: {
      'the-db': {
        connector: 'memory',
        defaultForType: 'db'
      }
    }
  });

  it('configures models', function() {
    boot.execute(app, dummyInstructions);
    assert(app.models);
    assert(app.models.User);
    assert.equal(app.models.User, loopback.User,
      'Boot should not have extended loopback.User model');
    assertValidDataSource(app.models.User.dataSource);
    assert.isFunc(app.models.User, 'find');
    assert.isFunc(app.models.User, 'create');
  });

  it('defines and customizes models', function() {
    appdir.writeFileSync('models/Customer.js', 'module.exports = ' +
      function(Customer) {
        Customer.settings._customized = 'Customer';
        Customer.base.settings._customized = 'Base';
      }.toString());

    boot.execute(app, someInstructions({
      models: [
        {
          name: 'Customer',
          config: { dataSource: 'db' },
          definition: {
            name: 'Customer',
            base: 'User',
          },
          sourceFile: path.resolve(appdir.PATH, 'models', 'Customer.js')
        }
      ]
    }));

    expect(app.models.Customer).to.exist();
    expect(app.models.Customer.settings._customized).to.be.equal('Customer');
    expect(loopback.User.settings._customized).to.equal('Base');
  });

  it('defines model without attaching it', function() {
    boot.execute(app, someInstructions({
      models: [
        {
          name: 'Vehicle',
          config: undefined,
          definition: {
            name: 'Vehicle'
          },
          sourceFile: undefined
        },
        {
          name: 'Car',
          config: { dataSource: 'db' },
          definition: {
            name: 'Car',
            base: 'Vehicle',
          },
          sourceFile: undefined
        },
      ]
    }));

    expect(Object.keys(app.models)).to.eql(['Car']);
  });

  it('attaches models to data sources', function() {
    boot.execute(app, dummyInstructions);
    assert.equal(app.models.User.dataSource, app.dataSources.theDb);
  });

  it('defines all models first before running the config phase', function() {
    appdir.writeFileSync('models/Customer.js', 'module.exports = ' +
      function(Customer/*, Base*/) {
        Customer.on('attached', function() {
          Customer._modelsWhenAttached =
            Object.keys(Customer.modelBuilder.models);
        });
      }.toString());

    boot.execute(app, someInstructions({
      models: [
        {
          name: 'Customer',
          config: { dataSource: 'db' },
          definition: { name: 'Customer' },
          sourceFile: path.resolve(appdir.PATH, 'models', 'Customer.js')
        },
        {
          name: 'UniqueName',
          config: { dataSource: 'db' },
          definition: { name: 'UniqueName' },
          sourceFile: undefined
        }
      ]
    }));

    expect(app.models.Customer._modelsWhenAttached).to.include('UniqueName');
  });

  it('instantiates data sources', function() {
    boot.execute(app, dummyInstructions);
    assert(app.dataSources);
    assert(app.dataSources.theDb);
    assertValidDataSource(app.dataSources.theDb);
    assert(app.dataSources.TheDb);
  });

  it('does not call autoAttach', function() {
    boot.execute(app, dummyInstructions);

    // loopback-datasource-juggler quirk:
    // Model.dataSources has modelBuilder as the default value,
    // therefore it's not enough to assert a false-y value
    var actual = loopback.Email.dataSource instanceof loopback.DataSource ?
      'attached' : 'not attached';
    expect(actual).to.equal('not attached');
  });

  it('skips definition of already defined LoopBack models', function() {
    var builtinModel = {
      name: 'User',
      definition: fs.readJsonFileSync(
        require.resolve('loopback/common/models/user.json')
      ),
      config: { dataSource: 'db' },
      sourceFile: require.resolve('loopback/common/models/user.js')
    };
    builtinModel.definition.redefined = true;

    boot.execute(app, someInstructions({ models: [builtinModel] }));

    expect(app.models.User.settings.redefined, 'redefined').to.not.equal(true);
  });

  describe('with boot and models files', function() {
    beforeEach(function() {
      boot.execute(app, simpleAppInstructions());
    });

    afterEach(function() {
      delete process.bootFlags;
    });

    it('should run `boot/*` files', function(done) {
      // scripts are loaded by the order of file names
      expect(process.bootFlags).to.eql([
        'barLoaded',
        'barSyncLoaded',
        'fooLoaded',
        'barStarted'
      ]);

      // bar finished happens in the next tick
      // barSync executed after bar finished
      setTimeout(function() {
        expect(process.bootFlags).to.eql([
          'barLoaded',
          'barSyncLoaded',
          'fooLoaded',
          'barStarted',
          'barFinished',
          'barSyncExecuted'
        ]);
        done();
      }, 10);
    });
  });

  describe('with boot with callback', function() {
    it('should run `boot/*` files asynchronously', function(done) {
      boot.execute(app, simpleAppInstructions(), function() {
        expect(process.bootFlags).to.eql([
          'barLoaded',
          'barSyncLoaded',
          'fooLoaded',
          'barStarted',
          'barFinished',
          'barSyncExecuted'
        ]);
        done();
      });
    });
  });

  describe('with PaaS and npm env variables', function() {
    function bootWithDefaults() {
      app = loopback();
      boot.execute(app, someInstructions({
        config: {
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
      // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
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
      boot.execute(app, someInstructions({ config: { port: 0 } }));
      assert.equal(app.get('port'), 0);
    });

    it('should default to port 3000', function() {
      boot.execute(app, someInstructions({ config: { port: undefined } }));
      assert.equal(app.get('port'), 3000);
    });
  });

  it('calls function exported by boot/init.js', function() {
    var file = appdir.writeFileSync('boot/init.js',
      'module.exports = function(app) { app.fnCalled = true; };');

    delete app.fnCalled;
    boot.execute(app, someInstructions({ files: { boot: [file] } }));
    expect(app.fnCalled, 'exported fn was called').to.be.true();
  });

  it('configures middleware', function(done) {
    var pushNamePath = require.resolve('./helpers/push-name-middleware');

    boot.execute(app, someInstructions({
      middleware: {
        phases: ['initial', 'custom'],
        middleware: [
          {
            sourceFile: pushNamePath,
            config: {
              phase: 'initial',
              params: 'initial'
            }
          },
          {
            sourceFile: pushNamePath,
            config: {
              phase: 'custom',
              params: 'custom'
            }
          },
          {
            sourceFile: pushNamePath,
            config: {
              phase: 'routes',
              params: 'routes'
            }
          },
          {
            sourceFile: pushNamePath,
            config: {
              phase: 'routes',
              enabled: false,
              params: 'disabled'
            }
          }
        ]
      }
    }));

    supertest(app)
      .get('/')
      .end(function(err, res) {
        if (err) return done(err);
        var names = (res.headers.names || '').split(',');
        expect(names).to.eql(['initial', 'custom', 'routes']);
        done();
      });
  });

  it('configures middleware using shortform', function(done) {

    boot.execute(app, someInstructions({
      middleware: {
        middleware: [
          {
            sourceFile: require.resolve('loopback'),
            fragment: 'static',
            config: {
              phase: 'files',
              params: path.join(__dirname, './fixtures/simple-app/client/')
            }
          }
        ]
      }
    }));

    supertest(app)
      .get('/')
      .end(function(err, res) {
        if (err) return done(err);
        expect(res.text).to.eql('<!DOCTYPE html>\n<html>\n<head lang="en">\n' +
          '    <meta charset="UTF-8">\n    <title>simple-app</title>\n' +
          '</head>\n<body>\n<h1>simple-app</h1>\n</body>\n</html>');
        done();
      });
  });

  it('configures middleware (end-to-end)', function(done) {
    boot.execute(app, simpleAppInstructions());

    supertest(app)
      .get('/')
      .end(function(err, res) {
        if (err) return done(err);
        expect(res.headers.names).to.equal('custom-middleware');
        done();
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

assert.isFunc = function(obj, name) {
  assert(obj, 'cannot assert function ' + name +
    ' on object that does not exist');
  assert(typeof obj[name] === 'function', name + ' is not a function');
};

function someInstructions(values) {
  var result = {
    config: values.config || {},
    models: values.models || [],
    dataSources: values.dataSources || { db: { connector: 'memory' } },
    middleware: values.middleware || { phases: [], middleware: [] },
    files: {
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
  // Copy it so that require will happend again
  fs.copySync(SIMPLE_APP, appdir.PATH);
  return boot.compile(appdir.PATH);
}
