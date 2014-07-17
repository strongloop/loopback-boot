var boot = require('../');
var fs = require('fs-extra');
var path = require('path');
var assert = require('assert');
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
      };
      instructions = boot.compile(options);
      appConfig = instructions.app;
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
      expect(instructions.models).to.eql(options.models);
    });

    it('has datasources definition', function() {
      expect(instructions.dataSources).to.eql(options.dataSources);
    });
  });

  describe('from directory', function() {
    it('loads config files', function() {
      var instructions = boot.compile(SIMPLE_APP);
      assert(instructions.models.foo);
      assert(instructions.models.foo.dataSource);
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

    it('refuses to merge Object properties', function() {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: { nested: { key: 'value' } }
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/`nested` is not a value type/);
    });

    it('refuses to merge Array properties', function() {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: { nested: ['value'] }
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/`nested` is not a value type/);
    });

    it('merges app configs from multiple files', function() {
      appdir.createConfigFilesSync();

      appdir.writeConfigFileSync('app.local.json', { cfgLocal: 'applied' });

      var env = process.env.NODE_ENV || 'development';
      appdir.writeConfigFileSync('app.' + env + '.json', { cfgEnv: 'applied' });

      var instructions = boot.compile(appdir.PATH);
      var appConfig = instructions.app;

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
      appdir.writeFileSync('app.local.js',
        'module.exports = { fromJs: true };');

      var instructions = boot.compile(appdir.PATH);
      var appConfig = instructions.app;

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
      appdir.writeConfigFileSync('custom/models.json', {
        foo: { dataSource: 'db' }
      });

      var fooJs = appdir.writeFileSync('custom/models/foo.js', '');

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        modelsRootDir: path.resolve(appdir.PATH, 'custom')
      });

      expect(instructions.models).to.have.property('foo');
      expect(instructions.files.models).to.eql([fooJs]);
    });

    it('includes boot/*.js scripts', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      var instructions = boot.compile(appdir.PATH);
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('supports models/ subdirectires that are not require()able', function() {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('models/test/model.test.js',
        'throw new Error("should not been called");');
      var instructions = boot.compile(appdir.PATH);

      expect(instructions.files.models).to.eql([]);
    });

    it('returns a new copy of JSON data', function() {
      appdir.createConfigFilesSync();

      var instructions = boot.compile(appdir.PATH);
      instructions.app.modified = true;

      instructions = boot.compile(appdir.PATH);
      expect(instructions.app).to.not.have.property('modified');
    });
  });
});
