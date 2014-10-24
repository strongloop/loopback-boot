var boot = require('../');
var fs = require('fs-extra');
var path = require('path');
var expect = require('must');
var sandbox = require('./helpers/sandbox');
var appdir = require('./helpers/appdir');

var SIMPLE_APP = path.join(__dirname, 'fixtures', 'simple-app');

describe('compiler', function() {
  beforeEach(sandbox.reset);
  beforeEach(appdir.init);

  describe('from options', function() {
    var options, instructions, appConfig;
    beforeEach(function() {
      options = {
        config: {
          port: 3000,
          host: '127.0.0.1',
          restApiRoot: '/rest-api',
          foo: {bar: 'bat'},
          baz: true
        },
        models: {
          'foo-bar-bat-baz': {
            dataSource: 'the-db'
          }
        },
        dataSources: {
          'the-db': {
            connector: 'memory',
            defaultForType: 'db'
          }
        }
      };
      instructions = boot.compile(options);
      appConfig = instructions.config;
    });

    it('has port setting', function() {
      expect(appConfig).to.have.property('port', 3000);
    });

    it('has host setting', function() {
      expect(appConfig).to.have.property('host', '127.0.0.1');
    });

    it('has restApiRoot setting', function() {
      expect(appConfig).to.have.property('restApiRoot', '/rest-api');
    });

    it('has other settings', function() {
      expect(appConfig).to.have.property('baz', true);
      expect(appConfig.foo, 'appConfig.foo').to.eql({
        bar: 'bat'
      });
    });

    it('has models definition', function() {
      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0]).to.eql({
        name: 'foo-bar-bat-baz',
        config: {
          dataSource: 'the-db'
        },
        definition: undefined,
        sourceFile: undefined
      });
    });

    it('has datasources definition', function() {
      expect(instructions.dataSources).to.eql(options.dataSources);
    });
  });

  describe('from directory', function() {
    it('loads config files', function() {
      var instructions = boot.compile(SIMPLE_APP);

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0]).to.eql({
        name: 'User',
        config: {
          dataSource: 'db'
        },
        definition: undefined,
        sourceFile: undefined
      });
    });

    it('merges datasource configs from multiple files', function() {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: { local: 'applied' }
      });

      var env = process.env.NODE_ENV || 'development';
      appdir.writeConfigFileSync('datasources.' + env + '.json', {
        db: { env: 'applied' }
      });

      var instructions = boot.compile(appdir.PATH);

      var db = instructions.dataSources.db;
      expect(db).to.have.property('local', 'applied');
      expect(db).to.have.property('env', 'applied');

      var expectedLoadOrder = ['local', 'env'];
      var actualLoadOrder = Object.keys(db).filter(function(k) {
        return expectedLoadOrder.indexOf(k) !== -1;
      });

      expect(actualLoadOrder, 'load order').to.eql(expectedLoadOrder);
    });

    it('supports .js for custom datasource config files', function() {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('datasources.local.js',
        'module.exports = { db: { fromJs: true } };');

      var instructions = boot.compile(appdir.PATH);

      var db = instructions.dataSources.db;
      expect(db).to.have.property('fromJs', true);
    });

    it('merges new Object values', function() {
      var objectValue = { key: 'value' };
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: { nested: objectValue }
      });

      var instructions = boot.compile(appdir.PATH);

      var db = instructions.dataSources.db;
      expect(db).to.have.property('nested');
      expect(db.nested).to.eql(objectValue);
    });

    it('deeply merges Object values', function() {
      appdir.createConfigFilesSync({}, {
        email: {
          transport: {
            host: 'localhost'
          }
        }
      });

      appdir.writeConfigFileSync('datasources.local.json', {
        email: {
          transport: {
            host: 'mail.example.com'
          }
        }
      });

      var instructions = boot.compile(appdir.PATH);
      var email = instructions.dataSources.email;
      expect(email.transport.host).to.equal('mail.example.com');
    });

    it('deeply merges Array values of the same length', function() {
      appdir.createConfigFilesSync({}, {
        rest: {
          operations: [
            {
              template: {
                method: 'POST',
                url: 'http://localhost:12345'
              }
            }
          ]
        }

      });
      appdir.writeConfigFileSync('datasources.local.json', {
        rest: {
          operations: [
            {
              template: {
                url: 'http://api.example.com'
              }
            }
          ]
        }
      });

      var instructions = boot.compile(appdir.PATH);

      var rest = instructions.dataSources.rest;
      expect(rest.operations[0].template).to.eql({
        method: 'POST', // the value from datasources.json
        url: 'http://api.example.com' // overriden in datasources.local.json
      });
    });

    it('merges Array properties', function() {
      var arrayValue = ['value'];
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: { nested: arrayValue }
      });

      var instructions = boot.compile(appdir.PATH);

      var db = instructions.dataSources.db;
      expect(db).to.have.property('nested');
      expect(db.nested).to.eql(arrayValue);
    });

    it('refuses to merge Array properties of different length', function() {
      appdir.createConfigFilesSync({
        nest: {
          array: []
        }
      });

      appdir.writeConfigFileSync('config.local.json', {
        nest: {
          array: [
            {
              key: 'value'
            }
          ]
        }
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/array values of different length.*nest\.array/);
    });

    it('refuses to merge Array of different length in Array', function() {
      appdir.createConfigFilesSync({
        key: [[]]
      });

      appdir.writeConfigFileSync('config.local.json', {
        key: [['value']]
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/array values of different length.*key\[0\]/);
    });

    it('returns full key of an incorrect Array value', function() {
      appdir.createConfigFilesSync({
        toplevel: [
          {
            nested: []
          }
        ]
      });

      appdir.writeConfigFileSync('config.local.json', {
        toplevel: [
          {
            nested: [ 'value' ]
          }
        ]
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/array values of different length.*toplevel\[0\]\.nested/);
    });

    it('refuses to merge incompatible object properties', function() {
      appdir.createConfigFilesSync({
        key: []
      });
      appdir.writeConfigFileSync('config.local.json', {
        key: {}
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/incompatible types.*key/);
    });

    it('refuses to merge incompatible array items', function() {
      appdir.createConfigFilesSync({
        key: [[]]
      });
      appdir.writeConfigFileSync('config.local.json', {
        key: [{}]
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/incompatible types.*key\[0\]/);
    });

    it('merges app configs from multiple files', function() {
      appdir.createConfigFilesSync();

      appdir.writeConfigFileSync('config.local.json', { cfgLocal: 'applied' });

      var env = process.env.NODE_ENV || 'development';
      appdir.writeConfigFileSync('config.' + env + '.json',
        { cfgEnv: 'applied' });

      var instructions = boot.compile(appdir.PATH);
      var appConfig = instructions.config;

      expect(appConfig).to.have.property('cfgLocal', 'applied');
      expect(appConfig).to.have.property('cfgEnv', 'applied');

      var expectedLoadOrder = ['cfgLocal', 'cfgEnv'];
      var actualLoadOrder = Object.keys(appConfig).filter(function(k) {
        return expectedLoadOrder.indexOf(k) !== -1;
      });

      expect(actualLoadOrder, 'load order').to.eql(expectedLoadOrder);
    });

    it('supports .js for custom app config files', function() {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('config.local.js',
        'module.exports = { fromJs: true };');

      var instructions = boot.compile(appdir.PATH);
      var appConfig = instructions.config;

      expect(appConfig).to.have.property('fromJs', true);
    });

    it('supports `appConfigRootDir` option', function() {
      appdir.createConfigFilesSync({port:3000});

      var customDir = path.resolve(appdir.PATH, 'custom');
      fs.mkdirsSync(customDir);
      fs.renameSync(
        path.resolve(appdir.PATH, 'config.json'),
        path.resolve(customDir, 'config.json'));

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        appConfigRootDir: path.resolve(appdir.PATH, 'custom')
      });

     expect(instructions.config).to.have.property('port');
    });

    it('supports `dsRootDir` option', function() {
      appdir.createConfigFilesSync();

      var customDir = path.resolve(appdir.PATH, 'custom');
      fs.mkdirsSync(customDir);
      fs.renameSync(
        path.resolve(appdir.PATH, 'datasources.json'),
        path.resolve(customDir, 'datasources.json'));

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        dsRootDir: path.resolve(appdir.PATH, 'custom')
      });

      expect(instructions.dataSources).to.have.property('db');
    });

    it('supports `modelsRootDir` option', function() {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('custom/model-config.json', {
        foo: { dataSource: 'db' }
      });

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        modelsRootDir: path.resolve(appdir.PATH, 'custom')
      });

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0]).to.have.property('name', 'foo');
    });

    it('includes boot/*.js scripts', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      var instructions = boot.compile(appdir.PATH);
      expect(instructions.files.boot).to.eql([initJs]);
    });
    
    it('supports `bootDirs` option', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootDirs: [path.dirname(initJs)]
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });
    
    it('supports `bootScripts` option', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: [initJs]
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('ignores models/ subdirectory', function() {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('models/my-model.js', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.files).to.not.have.property('models');
    });

    it('throws when models-config.json contains 1.x `properties`', function() {
      appdir.createConfigFilesSync({}, {}, {
        foo: { properties: { name: 'string' } }
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/unsupported 1\.x format/);
    });

    it('throws when model-config.json contains 1.x `options.base`', function() {
      appdir.createConfigFilesSync({}, {}, {
        Customer: { options: { base: 'User' } }
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/unsupported 1\.x format/);
    });

    it('loads models from `./models`', function() {
      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', { name: 'Car' });
      appdir.writeFileSync('models/car.js', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0]).to.eql({
        name: 'Car',
        config: {
          dataSource: 'db'
        },
        definition: {
          name: 'Car'
        },
        sourceFile: path.resolve(appdir.PATH, 'models', 'car.js')
      });
    });

    it('loads coffeescript models from `./models`', function() {
      // add coffee-script to require.extensions
      require('coffee-script/register');

      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', { name: 'Car' });
      appdir.writeFileSync('models/car.coffee', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0]).to.eql({
        name: 'Car',
        config: {
          dataSource: 'db'
        },
        definition: {
          name: 'Car'
        },
        sourceFile: path.resolve(appdir.PATH, 'models', 'car.coffee')
      });
    });
    
    it('supports `modelSources` option', function() {
      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('custom-models/car.json', { name: 'Car' });
      appdir.writeFileSync('custom-models/car.js', '');
      
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        modelSources: ['./custom-models']
      });
      
      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0]).to.eql({
        name: 'Car',
        config: {
          dataSource: 'db'
        },
        definition: {
          name: 'Car'
        },
        sourceFile: path.resolve(appdir.PATH, 'custom-models', 'car.js')
      });
    });

    it('supports `sources` option in `model-config.json`', function() {
      appdir.createConfigFilesSync({}, {}, {
        _meta: {
          sources: ['./custom-models']
        },
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('custom-models/car.json', { name: 'Car' });
      appdir.writeFileSync('custom-models/car.js', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0]).to.eql({
        name: 'Car',
        config: {
          dataSource: 'db'
        },
        definition: {
          name: 'Car'
        },
        sourceFile: path.resolve(appdir.PATH, 'custom-models', 'car.js')
      });
    });

    it('supports sources relative to node_modules', function() {
      appdir.createConfigFilesSync({}, {}, {
        User: { dataSource: 'db' }
      });

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        modelSources: [
          'loopback/common/models',
          'loopback/common/dir-does-not-exist'
        ]
      });

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0]).to.eql({
        name: 'User',
        config: {
          dataSource: 'db'
        },
        definition: require('loopback/common/models/user.json'),
        sourceFile: require.resolve('loopback/common/models/user.js')
      });
    });

    it('handles model definitions with no code', function() {
      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', { name: 'Car' });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.models).to.eql([{
        name: 'Car',
        config: {
          dataSource: 'db'
        },
        definition: {
          name: 'Car'
        },
        sourceFile: undefined
      }]);
    });

    it('excludes models not listed in `model-config.json`', function() {
      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', { name: 'Car' });
      appdir.writeConfigFileSync('models/bar.json', { name: 'Bar' });

      var instructions = boot.compile(appdir.PATH);

      var models = instructions.models.map(getNameProperty);
      expect(models).to.eql(['Car']);
    });

    it('includes models used as Base models', function() {
      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', {
        name: 'Car',
        base: 'Vehicle'
      });
      appdir.writeConfigFileSync('models/vehicle.json', {
        name: 'Vehicle'
      });

      var instructions = boot.compile(appdir.PATH);
      var models = instructions.models;
      var modelNames = models.map(getNameProperty);

      expect(modelNames).to.eql(['Vehicle', 'Car']);
      expect(models[0].config).to.equal(undefined);
    });

    it('excludes pre-built base models', function() {
      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', {
        name: 'Car',
        base: 'Model'
      });

      var instructions = boot.compile(appdir.PATH);

      var modelNames = instructions.models.map(getNameProperty);
      expect(modelNames).to.eql(['Car']);
    });

    it('sorts models, base models first', function() {
      appdir.createConfigFilesSync({}, {}, {
        Vehicle: { dataSource: 'db' },
        FlyingCar: { dataSource: 'db' },
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', {
        name: 'Car',
        base: 'Vehicle'
      });
      appdir.writeConfigFileSync('models/vehicle.json', {
        name: 'Vehicle'
      });
      appdir.writeConfigFileSync('models/flying-car.json', {
        name: 'FlyingCar',
        base: 'Car'
      });

      var instructions = boot.compile(appdir.PATH);

      var modelNames = instructions.models.map(getNameProperty);
      expect(modelNames).to.eql(['Vehicle', 'Car', 'FlyingCar']);
    });

    it('detects circular Model dependencies', function() {
      appdir.createConfigFilesSync({}, {}, {
        Vehicle: { dataSource: 'db' },
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', {
        name: 'Car',
        base: 'Vehicle'
      });
      appdir.writeConfigFileSync('models/vehicle.json', {
        name: 'Vehicle',
        base: 'Car'
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/cyclic dependency/i);
    });

    it('returns a new copy of JSON data', function() {
      appdir.createConfigFilesSync();

      var instructions = boot.compile(appdir.PATH);
      instructions.config.modified = true;

      instructions = boot.compile(appdir.PATH);
      expect(instructions.config).to.not.have.property('modified');
    });
  });
});

function getNameProperty(obj) {
  return obj.name;
}
