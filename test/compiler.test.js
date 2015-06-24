var boot = require('../');
var fs = require('fs-extra');
var path = require('path');
var expect = require('chai').expect;
var sandbox = require('./helpers/sandbox');
var appdir = require('./helpers/appdir');

// add coffee-script to require.extensions
require('coffee-script/register');

var SIMPLE_APP = path.join(__dirname, 'fixtures', 'simple-app');

describe('compiler', function() {
  beforeEach(sandbox.reset);
  beforeEach(appdir.init);

  describe('from options', function() {
    var options;
    var instructions;
    var appConfig;

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

    describe('with custom model definitions', function() {
      var dataSources = {
        'the-db': { connector: 'memory' }
      };

      it('loads model without definition', function() {
        var instruction = boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-without-definition': {
              dataSource: 'the-db'
            }
          },
          modelDefinitions: [],
          dataSources: dataSources
        });
        expect(instruction.models[0].name)
          .to.equal('model-without-definition');
        expect(instruction.models[0].definition).to.equal(undefined);
        expect(instruction.models[0].sourceFile).to.equal(undefined);
      });

      it('loads coffeescript models', function() {
        var modelScript = appdir.writeFileSync(
          'custom-models/coffee-model-with-definition.coffee', '');
        var instruction = boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'coffee-model-with-definition': {
              dataSource: 'the-db'
            }
          },
          modelDefinitions: [
            {
              definition: {
                name: 'coffee-model-with-definition'
              },
              sourceFile: modelScript
            }
          ],
          dataSources: dataSources
        });
        expect(instruction.models[0].name)
          .to.equal('coffee-model-with-definition');
        expect(instruction.models[0].definition).to.eql({
          name: 'coffee-model-with-definition'
        });
        expect(instruction.models[0].sourceFile).to.equal(modelScript);
      });

      it('handles sourceFile path without extension (.js)', function() {
        var modelScript = appdir.writeFileSync(
          'custom-models/model-without-ext.coffee',
          '');
        var instruction = boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-without-ext': {
              dataSource: 'the-db'
            }
          },
          modelDefinitions: [{
            definition: {
              name: 'model-without-ext'
            },
            sourceFile: pathWithoutExtension(modelScript)
          }],
          dataSources: dataSources
        });
        expect(instruction.models[0].name).to.equal('model-without-ext');
        expect(instruction.models[0].sourceFile).to.equal(modelScript);
      });

      it('handles sourceFile path without extension (.coffee)', function() {
        var modelScript = appdir.writeFileSync(
          'custom-models/model-without-ext.coffee',
          '');
        var instruction = boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-without-ext': {
              dataSource: 'the-db'
            }
          },
          modelDefinitions: [{
            definition: {
              name: 'model-without-ext'
            },
            sourceFile: pathWithoutExtension(modelScript)
          }],
          dataSources: dataSources
        });
        expect(instruction.models[0].name).to.equal('model-without-ext');
        expect(instruction.models[0].sourceFile).to.equal(modelScript);
      });

      it('sets source file path if the file exist', function() {
        var modelScript = appdir.writeFileSync(
          'custom-models/model-with-definition.js',
          '');
        var instruction = boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-with-definition': {
              dataSource: 'the-db'
            }
          },
          modelDefinitions: [
            {
              definition: {
                name: 'model-with-definition'
              },
              sourceFile: modelScript
            }
          ],
          dataSources: dataSources
        });
        expect(instruction.models[0].name).to.equal('model-with-definition');
        expect(instruction.models[0].definition).not.to.equal(undefined);
        expect(instruction.models[0].sourceFile).to.equal(modelScript);
      });

      it('does not set source file path if the file does not exist.',
      function() {
        var instruction = boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-with-definition-with-falsey-source-file': {
              dataSource: 'the-db'
            }
          },
          modelDefinitions: [
            {
              definition: {
                name: 'model-with-definition-with-falsey-source-file'
              },
              sourceFile: appdir.resolve('custom-models',
                'file-does-not-exist.js')
            }
          ],
          dataSources: dataSources
        });
        expect(instruction.models[0].name)
          .to.equal('model-with-definition-with-falsey-source-file');
        expect(instruction.models[0].definition).not.to.equal(undefined);
        expect(instruction.models[0].sourceFile).to.equal(undefined);
      });

      it('does not set source file path if no source file supplied.',
      function() {
        var instruction = boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-with-definition-without-source-file-property': {
              dataSource: 'the-db'
            }
          },
          modelDefinitions: [
            {
              definition: {
                name: 'model-with-definition-without-source-file-property'
              }
              // sourceFile is not set
            }
          ],
          dataSources: dataSources
        });
        expect(instruction.models[0].name)
          .to.equal('model-with-definition-without-source-file-property');
        expect(instruction.models[0].definition).not.to.equal(undefined);
        expect(instruction.models[0].sourceFile).to.equal(undefined);
      });

      it('loads models defined in `models` only.', function() {
        var instruction = boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'some-model': {
              dataSource: 'the-db'
            }
          },
          modelDefinitions: [
            {
              definition: {
                name: 'some-model'
              }
            },
            {
              definition: {
                name: 'another-model'
              }
            }
          ],
          dataSources: dataSources
        });

        expect(instruction.models.map(getNameProperty))
          .to.eql(['some-model']);
      });
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
            nested: ['value']
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

    it('should resolve relative path in `bootDirs`', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootDirs:['./custom-boot']
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('should resolve non-relative path in `bootDirs`', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js', '');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootDirs:['custom-boot']
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('ignores index.js in `bootDirs`', function() {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('custom-boot/index.js', '');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootDirs:['./custom-boot']
      });
      expect(instructions.files.boot).to.have.length(0);
    });

    it('prefers coffeescript over json in `appRootDir/bootDir`', function() {
      appdir.createConfigFilesSync();
      var coffee = appdir.writeFileSync('./custom-boot/init.coffee', '');
      appdir.writeFileSync('./custom-boot/init.json', {});

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootDirs: ['./custom-boot']
      });
      expect(instructions.files.boot).to.eql([coffee]);
    });

    it('prefers coffeescript over json in `bootDir` non-relative path',
      function() {
      appdir.createConfigFilesSync();
      var coffee = appdir.writeFileSync('custom-boot/init.coffee',
        '');
      appdir.writeFileSync('custom-boot/init.json', '');

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootDirs: ['custom-boot']
      });
      expect(instructions.files.boot).to.eql([coffee]);
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

    it('should remove duplicate scripts', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootDirs:[path.dirname(initJs)],
        bootScripts: [initJs]
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('should resolve relative path in `bootScripts`', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['./custom-boot/init.js']
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('should resolve non-relative path in `bootScripts`', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js', '');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['custom-boot/init.js']
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('resolves missing extensions in `bootScripts`', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js', '');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootScripts:['./custom-boot/init']
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('resolves missing extensions in `bootScripts` in module relative path',
      function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('node_modules/custom-boot/init.js', '');

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['custom-boot/init']
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('resolves module relative path for `bootScripts`', function() {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('node_modules/custom-boot/init.js', '');
      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['custom-boot/init.js']
      });
      expect(instructions.files.boot).to.eql([initJs]);
    });

    it('explores `bootScripts` in app relative path', function() {
      appdir.createConfigFilesSync();
      var appJs = appdir.writeFileSync('./custom-boot/init.js', '');

      appdir.writeFileSync('node_modules/custom-boot/init.js', '');

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['custom-boot/init.js']
      });
      expect(instructions.files.boot).to.eql([appJs]);
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

    it('resolves relative path in `modelSources` option', function() {
      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('custom-models/car.json', { name: 'Car' });
      var appJS = appdir.writeFileSync('custom-models/car.js', '');

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        modelSources: ['./custom-models']
      });

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0].sourceFile).to.equal(appJS);
    });

    it('resolves module relative path in `modelSources` option', function() {
      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('node_modules/custom-models/car.json',
        { name: 'Car' });
      var appJS = appdir.writeFileSync('node_modules/custom-models/car.js', '');

      var instructions = boot.compile({
        appRootDir: appdir.PATH,
        modelSources: ['custom-models']
      });

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0].sourceFile).to.equal(appJS);
    });

    it('resolves relative path in `sources` option in `model-config.json`',
      function() {
      appdir.createConfigFilesSync({}, {}, {
        _meta: {
          sources: ['./custom-models']
        },
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('custom-models/car.json', { name: 'Car' });
      var appJS = appdir.writeFileSync('custom-models/car.js', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0].sourceFile).to.equal(appJS);
    });

    it('resolves module relative path in `sources` option in model-config.json',
      function() {
      appdir.createConfigFilesSync({}, {}, {
        _meta: {
          sources: ['custom-models']
        },
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('node_modules/custom-models/car.json',
        { name: 'Car' });

      var appJS = appdir.writeFileSync('node_modules/custom-models/car.js', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0].sourceFile).to.equal(appJS);
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

    it('uses file name as default value for model name', function() {
      appdir.createConfigFilesSync({}, {}, {
        Car: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', {});

      var instructions = boot.compile(appdir.PATH);

      var modelNames = instructions.models.map(getNameProperty);
      expect(modelNames).to.eql(['Car']);
    });

    it('uses `OrderItem` as default model name for file with name `order-item`',
      function() {
      appdir.createConfigFilesSync({}, {}, {
        OrderItem: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/order-item.json', {});

      var instructions = boot.compile(appdir.PATH);

      var modelNames = instructions.models.map(getNameProperty);
      expect(modelNames).to.eql(['OrderItem']);
    });

    it('uses `OrderItem` as default model name for file with name `order_item`',
      function() {
      appdir.createConfigFilesSync({}, {}, {
        OrderItem: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/order_item.json', {});

      var instructions = boot.compile(appdir.PATH);

      var modelNames = instructions.models.map(getNameProperty);
      expect(modelNames).to.eql(['OrderItem']);
    });

    it('uses `OrderItem` as default model name for file with name `order item`',
      function() {
      appdir.createConfigFilesSync({}, {}, {
        OrderItem: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/order item.json', {});

      var instructions = boot.compile(appdir.PATH);

      var modelNames = instructions.models.map(getNameProperty);
      expect(modelNames).to.eql(['OrderItem']);
    });

    it('overrides `default model name` by `name` in model definition',
      function() {
      appdir.createConfigFilesSync({}, {}, {
        overrideCar: { dataSource: 'db' }
      });
      appdir.writeConfigFileSync('models/car.json', { name: 'overrideCar'});

      var instructions = boot.compile(appdir.PATH);

      var modelNames = instructions.models.map(getNameProperty);
      expect(modelNames).to.eql(['overrideCar']);
    });

    it('overwrites model with same default name', function() {
      appdir.createConfigFilesSync({}, {}, {
        'OrderItem': { dataSource: 'db' }
      });

      appdir.writeConfigFileSync('models/order-item.json', {
        properties: {
          price: { type: 'number' }
        }
      });
      appdir.writeFileSync('models/order-item.js', '');

      appdir.writeConfigFileSync('models/orderItem.json', {
        properties: {
          quantity: { type: 'number' }
        }
      });
      var appJS = appdir.writeFileSync('models/orderItem.js', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.models).to.eql([{
        name: 'OrderItem',
        config: {
          dataSource: 'db'
        },
        definition: {
          name: 'OrderItem',
          properties: {
            quantity: {type: 'number'}
          }
        },
        sourceFile: appJS
      }]);
    });

    it('overwrites model with same name in model definition', function() {
      appdir.createConfigFilesSync({}, {}, {
        'customOrder': { dataSource: 'db' }
      });

      appdir.writeConfigFileSync('models/order1.json', {
        name : 'customOrder',
        properties: {
          price: { type: 'number' }
        }
      });
      appdir.writeFileSync('models/order1.js', '');

      appdir.writeConfigFileSync('models/order2.json', {
        name : 'customOrder',
        properties: {
          quantity: { type: 'number' }
        }
      });
      var appJS = appdir.writeFileSync('models/order2.js', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.models).to.eql([{
        name: 'customOrder',
        config: {
          dataSource: 'db'
        },
        definition: {
          name: 'customOrder',
          properties: {
            quantity: {type: 'number'}
          }
        },
        sourceFile: appJS
      }]);
    });

    it('returns a new copy of JSON data', function() {
      appdir.createConfigFilesSync();

      var instructions = boot.compile(appdir.PATH);
      instructions.config.modified = true;

      instructions = boot.compile(appdir.PATH);
      expect(instructions.config).to.not.have.property('modified');
    });

    describe('for mixins', function() {
      describe(' - mixinDirs', function() {
        function verifyMixinIsFoundViaMixinDirs(sourceFile, mixinDirs) {
          var appJS = appdir.writeFileSync(sourceFile, '');

          var instructions = boot.compile({
            appRootDir: appdir.PATH,
            mixinDirs: mixinDirs
          });

          expect(instructions.mixins[0].sourceFile).to.eql(appJS);
        }

        it('supports `mixinDirs` option', function() {
          verifyMixinIsFoundViaMixinDirs('custom-mixins/other.js',
            ['./custom-mixins']);
        });

        it('resolves relative path in `mixinDirs` option', function() {
          verifyMixinIsFoundViaMixinDirs('custom-mixins/other.js',
            ['./custom-mixins']);
        });

        it('resolves module relative path in `mixinDirs` option', function() {
          verifyMixinIsFoundViaMixinDirs('node_modules/custom-mixins/other.js',
            ['custom-mixins']);
        });
      });

      describe(' - mixinSources', function() {
        beforeEach(function() {
          appdir.createConfigFilesSync({}, {}, {
            Car: { dataSource: 'db' }
          });
          appdir.writeConfigFileSync('models/car.json', {
            name: 'Car',
            mixins: {'TimeStamps': {} }
          });
        });

        function verifyMixinIsFoundViaMixinSources(sourceFile, mixinSources) {
          var appJS = appdir.writeFileSync(sourceFile, '');

          var instructions = boot.compile({
            appRootDir: appdir.PATH,
            mixinSources: mixinSources
          });

          expect(instructions.mixins[0].sourceFile).to.eql(appJS);
        }

        it('supports `mixinSources` option', function() {
          verifyMixinIsFoundViaMixinSources('mixins/time-stamps.js',
            ['./mixins']);
        });

        it('resolves relative path in `mixinSources` option', function() {
          verifyMixinIsFoundViaMixinSources('custom-mixins/time-stamps.js',
            ['./custom-mixins']);
        });

        it('resolves module relative path in `mixinSources` option',
          function() {
          verifyMixinIsFoundViaMixinSources(
            'node_modules/custom-mixins/time-stamps.js',
            ['custom-mixins']);
        });

        it('supports `mixins` option in `model-config.json`', function() {
          appdir.createConfigFilesSync({}, {}, {
            _meta: {
              mixins: ['./custom-mixins']
            },
            Car: {
              dataSource: 'db'
            }
          });

          var appJS = appdir.writeFileSync('custom-mixins/time-stamps.js', '');
          var instructions = boot.compile(appdir.PATH);
          expect(instructions.mixins[0].sourceFile).to.eql(appJS);
        });

        it('sets by default `mixinSources` to `mixins` directory', function() {
          var appJS = appdir.writeFileSync('mixins/time-stamps.js', '');
          var instructions = boot.compile(appdir.PATH);
          expect(instructions.mixins[0].sourceFile).to.eql(appJS);
        });

        it('loads only mixins used by models', function() {
          var appJS = appdir.writeFileSync('mixins/time-stamps.js', '');
          appdir.writeFileSync('mixins/foo.js', '');

          var instructions = boot.compile(appdir.PATH);
          expect(instructions.mixins).to.have.length(1);
          expect(instructions.mixins[0].sourceFile).to.eql(appJS);
        });

        it('loads mixins from model using mixin name in JSON file', function() {
          var appJS = appdir.writeFileSync('mixins/time-stamps.js', '');
          appdir.writeConfigFileSync('mixins/time-stamps.json', {
            name: 'Timestamping'
          });

          appdir.writeConfigFileSync('models/car.json', {
            name: 'Car',
            mixins: {'Timestamping': {} }
          });

          var instructions = boot.compile(appdir.PATH);
          expect(instructions.mixins).to.have.length(1);
          expect(instructions.mixins[0].sourceFile).to.eql(appJS);
        });

        it('loads mixin only once for dirs common to mixinDirs & mixinSources',
          function() {
          var appJS = appdir.writeFileSync('custom-mixins/time-stamps.js', '');

          var options = {
            appRootDir: appdir.PATH,
            mixinDirs: ['./custom-mixins'],
            mixinSources: ['./custom-mixins']
          };

          var instructions = boot.compile(options);
          expect(instructions.mixins).to.have.length(1);
          expect(instructions.mixins[0].sourceFile).to.eql(appJS);
        });

        it('loads mixin from mixinSources, when it is also found in mixinDirs',
          function() {
          appdir.writeFileSync('mixinDir/time-stamps.js', '');
          var appJS = appdir.writeFileSync('mixinSource/time-stamps.js', '');

          var options = {
            appRootDir: appdir.PATH,
            mixinDirs: ['./mixinDir'],
            mixinSources: ['./mixinSource']
          };

          var instructions = boot.compile(options);
          expect(instructions.mixins).to.have.length(1);
          expect(instructions.mixins[0].sourceFile).to.eql(appJS);
        });

        it('loads mixin from the most recent mixin definition', function() {
          appdir.writeFileSync('mixins1/time-stamps.js', '');
          var mixins2 = appdir.writeFileSync('mixins2/time-stamps.js', '');

          var options = {
            appRootDir: appdir.PATH,
            mixinSources: ['./mixins1', './mixins2']
          };

          var instructions = boot.compile(options);
          expect(instructions.mixins).to.have.length(1);
          expect(instructions.mixins[0].sourceFile).to.eql(mixins2);
        });
      });

      describe('name normalization', function() {
        var options;
        beforeEach(function() {
          options = { appRootDir: appdir.PATH, mixinDirs: ['./custom-mixins'] };

          appdir.writeFileSync('custom-mixins/foo.js', '');
          appdir.writeFileSync('custom-mixins/time-stamps.js', '');
          appdir.writeFileSync('custom-mixins/camelCase.js', '');
          appdir.writeFileSync('custom-mixins/PascalCase.js', '');
          appdir.writeFileSync('custom-mixins/space name.js', '');
        });

        it('supports classify', function() {
          options.normalization = 'classify';
          var instructions = boot.compile(options);

          var mixins = instructions.mixins;
          var mixinNames = mixins.map(getNameProperty);

          expect(mixinNames).to.eql([
            'CamelCase', 'Foo', 'PascalCase', 'SpaceName', 'TimeStamps'
          ]);
        });

        it('supports dasherize', function() {
          options.normalization = 'dasherize';
          var instructions = boot.compile(options);

          var mixins = instructions.mixins;
          var mixinNames = mixins.map(getNameProperty);

          expect(mixinNames).to.eql([
            'camel-case', 'foo', 'pascal-case', 'space-name', 'time-stamps'
          ]);
        });

        it('supports custom function', function() {
          var normalize = function(name) { return name.toUpperCase(); };
          options.normalization = normalize;
          var instructions = boot.compile(options);

          var mixins = instructions.mixins;
          var mixinNames = mixins.map(getNameProperty);

          expect(mixinNames).to.eql([
            'CAMELCASE', 'FOO', 'PASCALCASE', 'SPACE NAME', 'TIME-STAMPS'
          ]);
        });

        it('supports none', function() {
          options.normalization = 'none';
          var instructions = boot.compile(options);

          var mixins = instructions.mixins;
          var mixinNames = mixins.map(getNameProperty);

          expect(mixinNames).to.eql([
            'camelCase', 'foo', 'PascalCase', 'space name', 'time-stamps'
          ]);
        });

        it('supports false', function() {
          options.normalization = false;
          var instructions = boot.compile(options);

          var mixins = instructions.mixins;
          var mixinNames = mixins.map(getNameProperty);

          expect(mixinNames).to.eql([
            'camelCase', 'foo', 'PascalCase', 'space name', 'time-stamps'
          ]);
        });

        it('defaults to classify', function() {
          var instructions = boot.compile(options);

          var mixins = instructions.mixins;
          var mixinNames = mixins.map(getNameProperty);

          expect(mixinNames).to.eql([
            'CamelCase', 'Foo', 'PascalCase', 'SpaceName', 'TimeStamps'
          ]);
        });

        it('throws error for invalid normalization format', function() {
          options.normalization = 'invalidFormat';

          expect(function() { boot.compile(options); })
          .to.throw(/Invalid normalization format - "invalidFormat"/);
        });
      });

      it('overrides default mixin name, by `name` in JSON', function() {
        appdir.writeFileSync('mixins/foo.js', '');
        appdir.writeConfigFileSync('mixins/foo.json', {name: 'fooBar'});

        var options = { appRootDir: appdir.PATH,
          mixinDirs: ['./mixins']
        };
        var instructions = boot.compile(options);

        expect(instructions.mixins[0].name).to.eql('fooBar');
      });

      it('extends definition from JSON with same file name', function() {
        var appJS = appdir.writeFileSync('custom-mixins/foo-bar.js', '');

        appdir.writeConfigFileSync('custom-mixins/foo-bar.json', {
          description: 'JSON file name same as JS file name' });
        appdir.writeConfigFileSync('custom-mixins/FooBar.json', {
          description: 'JSON file name same as normalized name of mixin' });

        var options = { appRootDir: appdir.PATH,
          mixinDirs: ['./custom-mixins'],
          normalization: 'classify' };
        var instructions = boot.compile(options);

        expect(instructions.mixins).to.eql([
          {
            name: 'FooBar',
            description: 'JSON file name same as JS file name',
            sourceFile: appJS
          }
        ]);
      });
    });
  });

  describe('for middleware', function() {

    function testMiddlewareRegistration(middlewareId, sourceFile) {
      var json = {
        initial: {
        },
        custom: {
        }
      };

      json.custom[middlewareId] = {
        params: 'some-config-data'
      };

      appdir.writeConfigFileSync('middleware.json', json);

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware).to.eql({
        phases: ['initial', 'custom'],
        middleware: [
          {
            sourceFile: sourceFile,
            config: {
              phase: 'custom',
              params: 'some-config-data'
            }
          }
        ]
      });
    }

    var sourceFileForUrlNotFound;
    beforeEach(function() {
      fs.copySync(SIMPLE_APP, appdir.PATH);
      sourceFileForUrlNotFound = require.resolve(
        'loopback/server/middleware/url-not-found');
    });

    it('emits middleware instructions', function() {
      testMiddlewareRegistration('loopback/server/middleware/url-not-found',
        sourceFileForUrlNotFound);
    });

    it('emits middleware instructions for fragment', function() {
      testMiddlewareRegistration('loopback#url-not-found',
        sourceFileForUrlNotFound);
    });

    it('fails when a module middleware cannot be resolved', function() {
      appdir.writeConfigFileSync('middleware.json', {
        final: {
          'loopback/path-does-not-exist': { }
        }
      });

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw(/path-does-not-exist/);
    });

    it('fails when a module middleware fragment cannot be resolved',
      function() {
        appdir.writeConfigFileSync('middleware.json', {
          final: {
            'loopback#path-does-not-exist': { }
          }
        });

        expect(function() {
          boot.compile(appdir.PATH);
        })
          .to.throw(/path-does-not-exist/);
      });

    it('resolves paths relatively to appRootDir', function() {
      appdir.writeFileSync('my-middleware.js', '');
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          // resolves to ./my-middleware.js
          './my-middleware': { }
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware).to.eql({
        phases: ['routes'],
        middleware: [{
          sourceFile: path.resolve(appdir.PATH, 'my-middleware.js'),
          config: { phase: 'routes' }
        }]
      });
    });

    it('merges config.params', function() {
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          './middleware': {
            params: {
              key: 'initial value'
            }
          }
        }
      });

      appdir.writeConfigFileSync('./middleware.local.json', {
        routes: {
          './middleware': {
            params: {
              key: 'custom value'
            }
          }
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expectFirstMiddlewareParams(instructions).to.eql({
        key: 'custom value'
      });
    });

    it('merges config.enabled', function() {
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          './middleware': {
            params: {
              key: 'initial value'
            }
          }
        }
      });

      appdir.writeConfigFileSync('./middleware.local.json', {
        routes: {
          './middleware': {
            enabled: false
          }
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware[0].config)
        .to.have.property('enabled', false);
    });

    it('flattens sub-phases', function() {
      appdir.writeConfigFileSync('middleware.json', {
        'initial:after': {
        },
        'custom:before': {
          'loopback/server/middleware/url-not-found': {
            params: 'some-config-data'
          }
        },
        'custom:after': {

        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.phases, 'phases')
        .to.eql(['initial', 'custom']);
      expect(instructions.middleware.middleware, 'middleware')
        .to.eql([{
          sourceFile:
            require.resolve('loopback/server/middleware/url-not-found'),
          config: {
            phase: 'custom:before',
            params: 'some-config-data'
          }
        }]);
    });

    it('supports multiple instances of the same middleware', function() {
      appdir.writeFileSync('my-middleware.js', '');
      appdir.writeConfigFileSync('middleware.json', {
        'final': {
          './my-middleware': [
            {
              params: 'first'
            },
            {
              params: 'second'
            }
          ]
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware)
        .to.eql([
          {
            sourceFile: path.resolve(appdir.PATH, 'my-middleware.js'),
            config: {
              phase: 'final',
              params: 'first'
            }
          },
          {
            sourceFile: path.resolve(appdir.PATH, 'my-middleware.js'),
            config: {
              phase: 'final',
              params: 'second'
            }
          }
        ]);
    });

    it('supports shorthand notation for middleware paths', function() {
      appdir.writeConfigFileSync('middleware.json', {
        'final': {
          'loopback#url-not-found': {}
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware[0].sourceFile)
        .to.equal(require.resolve('loopback/server/middleware/url-not-found'));
    });

    it('supports shorthand notation for relative paths', function() {
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          './middleware/index#myMiddleware': {
          }
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware[0].sourceFile)
        .to.equal(path.resolve(appdir.PATH,
          './middleware/index.js'));
      expect(instructions.middleware.middleware[0]).have.property(
        'fragment',
        'myMiddleware');
    });

    it('supports shorthand notation when the fragment name matches a property',
      function() {
        appdir.writeConfigFileSync('middleware.json', {
          'final': {
            'loopback#errorHandler': {}
          }
        });

        var instructions = boot.compile(appdir.PATH);

        expect(instructions.middleware.middleware[0]).have.property(
          'sourceFile',
          pathWithoutIndex(require.resolve('loopback')));
        expect(instructions.middleware.middleware[0]).have.property(
          'fragment',
          'errorHandler');
      });

    it('resolves modules relative to appRootDir', function() {
      var HANDLER_FILE = 'node_modules/handler/index.js';
      appdir.writeFileSync(
        HANDLER_FILE,
        'module.exports = function(req, res, next) { next(); }');

      appdir.writeConfigFileSync('middleware.json', {
        'initial': {
          'handler': {}
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware[0]).have.property(
        'sourceFile',
        pathWithoutIndex(appdir.resolve(HANDLER_FILE)));
    });

    it('prefers appRootDir over node_modules for middleware', function() {
      var appJS = appdir.writeFileSync('./my-middleware.js', '');
      appdir.writeFileSync('node_modules/my-middleware.js', '');
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          './my-middleware': {}
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware).to.have.length(1);
      expect(instructions.middleware.middleware[0]).have.property(
        'sourceFile', appJS);
    });

    it('does not treat module relative path as `appRootDir` relative',
      function() {
      appdir.writeFileSync('./my-middleware.js', '');
      var moduleJS = appdir.writeFileSync('node_modules/my-middleware.js', '');
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          'my-middleware': {}
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware).to.have.length(1);
      expect(instructions.middleware.middleware[0]).have.property(
        'sourceFile', moduleJS);
    });

    it('loads middleware from coffeescript in appRootdir', function() {
      var coffee = appdir.writeFileSync('my-middleware.coffee', '');
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          './my-middleware': {}
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware[0]).have.property(
        'sourceFile', coffee);
    });

    it('loads coffeescript from middleware under node_modules',
      function() {
      var file = appdir.writeFileSync('node_modules/my-middleware/index.coffee',
        '');
      appdir.writeFileSync('node_modules/my-middleware/index.json', '');
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          'my-middleware': {}
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware).to.have.length(1);
      expect(instructions.middleware.middleware[0]).have.property(
        'sourceFile', pathWithoutIndex(file));
    });

    it('prefers coffeescript over json for relative middleware path',
      function() {
      var coffee = appdir.writeFileSync('my-middleware.coffee', '');
      appdir.writeFileSync('my-middleware.json', '');
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          './my-middleware': {}
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware).to.have.length(1);
      expect(instructions.middleware.middleware[0]).have.property(
        'sourceFile', coffee);
    });

    it('prefers coffeescript over json for module relative middleware path',
      function() {
      var coffee = appdir.writeFileSync('node_modules/my-middleware.coffee',
        '');
      appdir.writeFileSync('node_modules/my-middleware.json', '');
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          'my-middleware': {}
        }
      });

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.middleware.middleware).to.have.length(1);
      expect(instructions.middleware.middleware[0]).have.property(
        'sourceFile', coffee);
    });

    describe('config with relative paths in params', function() {
      var RELATIVE_PATH_PARAMS = [
        '$!./here',
        '$!../there'
      ];

      var absolutePathParams;
      beforeEach(function resolveRelativePathParams() {
        absolutePathParams = RELATIVE_PATH_PARAMS.map(function(p) {
          return appdir.resolve(p.slice(2));
        });
      });

      it('converts paths in top-level array items', function() {
        givenMiddlewareEntrySync({ params: RELATIVE_PATH_PARAMS });

        var instructions = boot.compile(appdir.PATH);

        expectFirstMiddlewareParams(instructions)
          .to.eql(absolutePathParams);
      });

      it('converts paths in top-level object properties', function() {
        givenMiddlewareEntrySync({ params: {
          path: RELATIVE_PATH_PARAMS[0],
        }});

        var instructions = boot.compile(appdir.PATH);

        expectFirstMiddlewareParams(instructions)
          .to.eql({ path: absolutePathParams[0] });
      });

      it('converts path value when params is a string', function() {
        givenMiddlewareEntrySync({ params: RELATIVE_PATH_PARAMS[0] });

        var instructions = boot.compile(appdir.PATH);

        expectFirstMiddlewareParams(instructions)
          .to.eql(absolutePathParams[0]);
      });

      it('converts paths in nested properties', function() {
        givenMiddlewareEntrySync({ params: {
          nestedObject: {
            path: RELATIVE_PATH_PARAMS[0]
          },
          nestedArray: RELATIVE_PATH_PARAMS
        }});

        var instructions = boot.compile(appdir.PATH);

        expectFirstMiddlewareParams(instructions)
          .to.eql({
            nestedObject: {
              path: absolutePathParams[0]
            },
            nestedArray: absolutePathParams
          });
      });

      it('does not convert values not starting with `./` or `../`', function() {
        var PARAMS = ['$!.somerc', '$!/root', '$!hello!'];
        givenMiddlewareEntrySync({ params: PARAMS});

        var instructions = boot.compile(appdir.PATH);

        expectFirstMiddlewareParams(instructions).to.eql(PARAMS);
      });
    });
  });

  describe('for components', function() {
    it('loads component configs from multiple files', function() {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('component-config.json', {
        debug: { option: 'value' }
      });
      appdir.writeConfigFileSync('component-config.local.json', {
        debug: { local: 'applied' }
      });

      var env = process.env.NODE_ENV || 'development';
      appdir.writeConfigFileSync('component-config.' + env + '.json', {
        debug: { env: 'applied' }
      });

      var instructions = boot.compile(appdir.PATH);

      var component = instructions.components[0];
      expect(component).to.eql({
        sourceFile: require.resolve('debug'),
        config: {
          option: 'value',
          local: 'applied',
          env: 'applied'
        }
      });
    });

    it('loads component relative to appRootDir', function() {
      appdir.writeConfigFileSync('./component-config.json', {
        './index': { }
      });
      var appJS = appdir.writeConfigFileSync('index.js', '');

      var instructions = boot.compile(appdir.PATH);
      expect(instructions.components[0]).have.property(
        'sourceFile', appJS
      );
    });

    it('loads component relative to node modules', function() {
      appdir.writeConfigFileSync('component-config.json', {
        'mycomponent': { }
      });
      var js = appdir.writeConfigFileSync('node_modules/mycomponent/index.js',
        '');

      var instructions = boot.compile(appdir.PATH);
      expect(instructions.components[0]).have.property(
        'sourceFile', js
      );
    });

    it('retains backward compatibility for non-relative path in `appRootDir`',
      function() {
      appdir.writeConfigFileSync('component-config.json', {
        'my-component/component.js': { }
      });
      appdir.writeConfigFileSync('./my-component/component.js', '');

      expect(function() { boot.compile(appdir.PATH); })
        .to.throw('Cannot resolve path \"my-component/component.js\"');
    });

    it('prefers coffeescript over json for relative path component',
      function() {
      appdir.writeConfigFileSync('component-config.json', {
        './component': { }
      });

      var coffee = appdir.writeFileSync('component.coffee', '');
      appdir.writeFileSync('component.json', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.components).to.have.length(1);
      expect(instructions.components[0]).have.property(
        'sourceFile', coffee);
    });

    it('prefers coffeescript over json for module relative component path',
      function() {
      appdir.writeConfigFileSync('component-config.json', {
        'component': { }
      });

      var coffee = appdir.writeFileSync('node_modules/component.coffee', '');
      appdir.writeFileSync('node_modules/component.json', '');

      var instructions = boot.compile(appdir.PATH);

      expect(instructions.components).to.have.length(1);
      expect(instructions.components[0]).have.property(
        'sourceFile', coffee);
    });

  });
});

function getNameProperty(obj) {
  return obj.name;
}

function givenMiddlewareEntrySync(config) {
  appdir.writeConfigFileSync('middleware.json', {
    initial: {
      // resolves to ./middleware.json
      './middleware': config
    }
  });
}

function expectFirstMiddlewareParams(instructions) {
  return expect(instructions.middleware.middleware[0].config.params);
}

function pathWithoutExtension(value) {
  return path.join(
    path.dirname(value),
    path.basename(value, path.extname(value)));
}

function pathWithoutIndex(filePath) {
  return filePath.replace(/[\\\/]index\.[^.]+$/, '');
}
