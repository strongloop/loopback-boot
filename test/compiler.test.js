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

    it('merges Object properties', function() {
      var nestedValue = { key: 'value' };
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: { nested: nestedValue }
      });

      var instructions = boot.compile(appdir.PATH);

      var db = instructions.dataSources.db;
      expect(db).to.have.property('nested');
      expect(db.nested).to.eql(nestedValue);
    });

    it('merges nested Object properties', function() {
      var nestedValue = 'http://api.test.com';
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        rest: {
          operations: [
            {
              template: {
                url: nestedValue
              }
            }
          ]
        }
      });

      var instructions = boot.compile(appdir.PATH);

      var rest = instructions.dataSources.rest;
      expect(rest).to.have.property('operations');
      expect(rest.operations[0]).to.have.property('template');
      expect(rest.operations[0].template).to.have.property('url');
      expect(rest.operations[0].template.method).to.eql('POST');
      expect(rest.operations[0].template.url).to.eql(nestedValue);
    });

    it('merges Array properties', function() {
      var nestedValue = ['value'];
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: { nested: nestedValue }
      });

      var instructions = boot.compile(appdir.PATH);

      var db = instructions.dataSources.db;
      expect(db).to.have.property('nested');
      expect(db.nested).to.eql(nestedValue);
    });

    it('errors on mismatched arrays', function() {
      var nestedValue = 'http://api.test.com';
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        rest: {
          operations: [
            {
              template: {
                url: nestedValue
              }
            },
            {
              template: {
                method: 'GET',
                url: nestedValue
              }
            }
          ]
        }
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/an array and lengths mismatch/);
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
