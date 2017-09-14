// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

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

  function expectCompileToThrow(err, options, done) {
    if (typeof options === 'function') {
      done = options;
      options = undefined;
    }
    boot.compile(options || appdir.PATH, function(err) {
      expect(function() {
        if (err) throw err;
      }).to.throw(err);
      done();
    });
  }

  function expectCompileToNotThrow(options, done) {
    if (typeof options === 'function') {
      done = options;
      options = undefined;
    }
    boot.compile(options || appdir.PATH, function(err) {
      expect(function() {
        if (err) throw err;
      }).to.not.throw();
      done();
    });
  }

  describe('from options', function() {
    var options, instructions, appConfig;

    beforeEach(function(done) {
      options = {
        application: {
          port: 3000,
          host: '127.0.0.1',
          restApiRoot: '/rest-api',
          foo: {bar: 'bat'},
          baz: true,
        },
        models: {
          'foo-bar-bat-baz': {
            dataSource: 'the-db',
          },
        },
        dataSources: {
          'the-db': {
            connector: 'memory',
            defaultForType: 'db',
          },
        },
      };
      boot.compile(options, function(err, context) {
        if (err) return done(err);
        appConfig = context.instructions.application;
        instructions = context.instructions;
        done();
      });
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
        bar: 'bat',
      });
    });

    it('has models definition', function() {
      expect(instructions.models).to.have.length(1);
      expect(instructions.models[0]).to.eql({
        name: 'foo-bar-bat-baz',
        config: {
          dataSource: 'the-db',
        },
        definition: undefined,
        sourceFile: undefined,
      });
    });

    it('has datasources definition', function() {
      expect(instructions.dataSources).to.eql(options.dataSources);
    });

    describe('with custom model definitions', function(done) {
      var dataSources = {
        'the-db': {connector: 'memory'},
      };

      it('loads model without definition', function(done) {
        var instruction = boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-without-definition': {
              dataSource: 'the-db',
            },
          },
          modelDefinitions: [],
          dataSources: dataSources,
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.models[0].name)
            .to.equal('model-without-definition');
          expect(instructions.models[0].definition).to.equal(undefined);
          expect(instructions.models[0].sourceFile).to.equal(undefined);
          done();
        });
      });

      it('loads coffeescript models', function(done) {
        var modelScript = appdir.writeFileSync(
          'custom-models/coffee-model-with-definition.coffee', '');
        boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'coffee-model-with-definition': {
              dataSource: 'the-db',
            },
          },
          modelDefinitions: [
            {
              definition: {
                name: 'coffee-model-with-definition',
              },
              sourceFile: modelScript,
            },
          ],
          dataSources: dataSources,
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.models[0].name)
            .to.equal('coffee-model-with-definition');
          expect(instructions.models[0].definition).to.eql({
            name: 'coffee-model-with-definition',
          });
          expect(instructions.models[0].sourceFile).to.equal(modelScript);
          done();
        });
      });

      it('handles sourceFile path without extension (.js)', function(done) {
        var modelScript = appdir.writeFileSync(
          'custom-models/model-without-ext.coffee',
          '');
        boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-without-ext': {
              dataSource: 'the-db',
            },
          },
          modelDefinitions: [{
            definition: {
              name: 'model-without-ext',
            },
            sourceFile: pathWithoutExtension(modelScript),
          }],
          dataSources: dataSources,
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.models[0].name).to.equal('model-without-ext');
          expect(instructions.models[0].sourceFile).to.equal(modelScript);
          done();
        });
      });

      it('handles sourceFile path without extension (.coffee)', function(done) {
        var modelScript = appdir.writeFileSync(
          'custom-models/model-without-ext.coffee',
          '');
        boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-without-ext': {
              dataSource: 'the-db',
            },
          },
          modelDefinitions: [{
            definition: {
              name: 'model-without-ext',
            },
            sourceFile: pathWithoutExtension(modelScript),
          }],
          dataSources: dataSources,
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.models[0].name).to.equal('model-without-ext');
          expect(instructions.models[0].sourceFile).to.equal(modelScript);
          done();
        });
      });

      it('sets source file path if the file exist', function(done) {
        var modelScript = appdir.writeFileSync(
          'custom-models/model-with-definition.js',
          '');
        boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'model-with-definition': {
              dataSource: 'the-db',
            },
          },
          modelDefinitions: [
            {
              definition: {
                name: 'model-with-definition',
              },
              sourceFile: modelScript,
            },
          ],
          dataSources: dataSources,
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.models[0].name).to.equal('model-with-definition');
          expect(instructions.models[0].definition).not.to.equal(undefined);
          expect(instructions.models[0].sourceFile).to.equal(modelScript);
          done();
        });
      });

      it('does not set source file path if the file does not exist.',
        function(done) {
          boot.compile({
            appRootDir: appdir.PATH,
            models: {
              'model-with-definition-with-falsey-source-file': {
                dataSource: 'the-db',
              },
            },
            modelDefinitions: [
              {
                definition: {
                  name: 'model-with-definition-with-falsey-source-file',
                },
                sourceFile: appdir.resolve('custom-models',
                  'file-does-not-exist.js'),
              },
            ],
            dataSources: dataSources,
          }, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;
            expect(instructions.models[0].name)
              .to.equal('model-with-definition-with-falsey-source-file');
            expect(instructions.models[0].definition).not.to.equal(undefined);
            expect(instructions.models[0].sourceFile).to.equal(undefined);
            done();
          });
        });

      it('does not set source file path if no source file supplied.',
        function(done) {
          boot.compile({
            appRootDir: appdir.PATH,
            models: {
              'model-with-definition-without-source-file-property': {
                dataSource: 'the-db',
              },
            },
            modelDefinitions: [
              {
                definition: {
                  name: 'model-with-definition-without-source-file-property',
                },
                // sourceFile is not set
              },
            ],
            dataSources: dataSources,
          }, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;
            expect(instructions.models[0].name)
              .to.equal('model-with-definition-without-source-file-property');
            expect(instructions.models[0].definition).not.to.equal(undefined);
            expect(instructions.models[0].sourceFile).to.equal(undefined);
            done();
          });
        });

      it('loads models defined in `models` only.', function(done) {
        boot.compile({
          appRootDir: appdir.PATH,
          models: {
            'some-model': {
              dataSource: 'the-db',
            },
          },
          modelDefinitions: [
            {
              definition: {
                name: 'some-model',
              },
            },
            {
              definition: {
                name: 'another-model',
              },
            },
          ],
          dataSources: dataSources,
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.models.map(getNameProperty))
            .to.eql(['some-model']);
          done();
        });
      });
    });
  });

  describe('from directory', function(done) {
    it('loads config files', function(done) {
      boot.compile(SIMPLE_APP, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.eql({
          name: 'User',
          config: {
            dataSource: 'db',
          },
          definition: undefined,
          sourceFile: undefined,
        });
        done();
      });
    });

    it('merges datasource configs from multiple files', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: {local: 'applied'},
      });

      var env = process.env.NODE_ENV || 'development';
      appdir.writeConfigFileSync('datasources.' + env + '.json', {
        db: {env: 'applied'},
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var db = instructions.dataSources.db;
        expect(db).to.have.property('local', 'applied');
        expect(db).to.have.property('env', 'applied');

        var expectedLoadOrder = ['local', 'env'];
        var actualLoadOrder = Object.keys(db).filter(function(k) {
          return expectedLoadOrder.indexOf(k) !== -1;
        });

        expect(actualLoadOrder, 'load order').to.eql(expectedLoadOrder);
        done();
      });
    });

    it('supports .js for custom datasource config files', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('datasources.local.js',
        'module.exports = { db: { fromJs: true } };');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var db = instructions.dataSources.db;
        expect(db).to.have.property('fromJs', true);
        done();
      });
    });

    it('merges new Object values', function(done) {
      var objectValue = {key: 'value'};
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: {nested: objectValue},
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var db = instructions.dataSources.db;
        expect(db).to.have.property('nested');
        expect(db.nested).to.eql(objectValue);
        done();
      });
    });

    it('deeply merges Object values', function(done) {
      appdir.createConfigFilesSync({}, {
        email: {
          transport: {
            host: 'localhost',
          },
        },
      });

      appdir.writeConfigFileSync('datasources.local.json', {
        email: {
          transport: {
            host: 'mail.example.com',
          },
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        var email = instructions.dataSources.email;
        expect(email.transport.host).to.equal('mail.example.com');
        done();
      });
    });

    it('deeply merges Array values of the same length', function(done) {
      appdir.createConfigFilesSync({}, {
        rest: {
          operations: [
            {
              template: {
                method: 'POST',
                url: 'http://localhost:12345',
              },
            },
          ],
        },

      });
      appdir.writeConfigFileSync('datasources.local.json', {
        rest: {
          operations: [
            {
              template: {
                url: 'http://api.example.com',
              },
            },
          ],
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var rest = instructions.dataSources.rest;
        expect(rest.operations[0].template).to.eql({
          method: 'POST', // the value from datasources.json
          url: 'http://api.example.com', // overriden in datasources.local.json
        });
        done();
      });
    });

    it('merges Array properties', function(done) {
      var arrayValue = ['value'];
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('datasources.local.json', {
        db: {nested: arrayValue},
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var db = instructions.dataSources.db;
        expect(db).to.have.property('nested');
        expect(db.nested).to.eql(arrayValue);
        done();
      });
    });

    it('does not cache loaded values', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('middleware.json', {
        'strong-error-handler': {params: {debug: false}},
      });
      appdir.writeConfigFileSync('middleware.development.json', {
        'strong-error-handler': {params: {debug: true}},
      });

      // Here we load main config and merge it with DEV overrides
      var bootOptions = {
        appRootDir: appdir.PATH,
        env: 'development',
        phases: ['load'],
      };
      var productionBootOptions = {
        appRootDir: appdir.PATH,
        env: 'production',
        phases: ['load'],
      };
      boot.compile(bootOptions, function(err, context) {
        var config = context.configurations.middleware;
        expect(config['strong-error-handler'].params.debug,
          'debug in development').to.equal(true);

        boot.compile(productionBootOptions, function(err, context2) {
          var config = context2.configurations.middleware;
          expect(config['strong-error-handler'].params.debug,
            'debug in production').to.equal(false);
          done();
        });
      });
    });

    it('allows env specific model-config json', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('model-config.local.json', {
        foo: {dataSource: 'db'},
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.have.property('name', 'foo');
        done();
      });
    });

    it('allows env specific model-config json to be merged', function(done) {
      appdir.createConfigFilesSync(null, null,
        {foo: {dataSource: 'mongo', public: false}});
      appdir.writeConfigFileSync('model-config.local.json', {
        foo: {dataSource: 'db'},
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.have.property('name', 'foo');
        expect(instructions.models[0].config).to.eql({
          dataSource: 'db',
          public: false,
        });
        done();
      });
    });

    it('allows env specific model-config js', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('model-config.local.js',
        'module.exports = { foo: { dataSource: \'db\' } };');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.have.property('name', 'foo');
        done();
      });
    });

    it('refuses to merge Array properties of different length', function(done) {
      appdir.createConfigFilesSync({
        nest: {
          array: [],
        },
      });

      appdir.writeConfigFileSync('config.local.json', {
        nest: {
          array: [
            {
              key: 'value',
            },
          ],
        },
      });

      expectCompileToThrow(/array values of different length.*nest\.array/,
        done);
    });

    it('refuses to merge Array of different length in Array', function(done) {
      appdir.createConfigFilesSync({
        key: [[]],
      });

      appdir.writeConfigFileSync('config.local.json', {
        key: [['value']],
      });

      expectCompileToThrow(/array values of different length.*key\[0\]/, done);
    });

    it('returns full key of an incorrect Array value', function(done) {
      appdir.createConfigFilesSync({
        toplevel: [
          {
            nested: [],
          },
        ],
      });

      appdir.writeConfigFileSync('config.local.json', {
        toplevel: [
          {
            nested: ['value'],
          },
        ],
      });

      expectCompileToThrow(
        /array values of different length.*toplevel\[0\]\.nested/,
        done);
    });

    it('refuses to merge incompatible object properties', function(done) {
      appdir.createConfigFilesSync({
        key: [],
      });
      appdir.writeConfigFileSync('config.local.json', {
        key: {},
      });

      expectCompileToThrow(/incompatible types.*key/, done);
    });

    it('refuses to merge incompatible array items', function(done) {
      appdir.createConfigFilesSync({
        key: [[]],
      });
      appdir.writeConfigFileSync('config.local.json', {
        key: [{}],
      });

      expectCompileToThrow(/incompatible types.*key\[0\]/, done);
    });

    it('merges app configs from multiple files', function(done) {
      appdir.createConfigFilesSync();

      appdir.writeConfigFileSync('config.local.json', {cfgLocal: 'applied'});

      var env = process.env.NODE_ENV || 'development';
      appdir.writeConfigFileSync('config.' + env + '.json',
        {cfgEnv: 'applied'});

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        var appConfig = instructions.application;

        expect(appConfig).to.have.property('cfgLocal', 'applied');
        expect(appConfig).to.have.property('cfgEnv', 'applied');

        var expectedLoadOrder = ['cfgLocal', 'cfgEnv'];
        var actualLoadOrder = Object.keys(appConfig).filter(function(k) {
          return expectedLoadOrder.indexOf(k) !== -1;
        });

        expect(actualLoadOrder, 'load order').to.eql(expectedLoadOrder);
        done();
      });
    });

    it('supports .js for custom app config files', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('config.local.js',
        'module.exports = { fromJs: true };');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        var appConfig = instructions.application;

        expect(appConfig).to.have.property('fromJs', true);
        done();
      });
    });

    it('supports `appConfigRootDir` option', function(done) {
      appdir.createConfigFilesSync({port: 3000});

      var customDir = path.resolve(appdir.PATH, 'custom');
      fs.mkdirsSync(customDir);
      fs.renameSync(
        path.resolve(appdir.PATH, 'config.json'),
        path.resolve(customDir, 'config.json'));

      boot.compile({
        appRootDir: appdir.PATH,
        appConfigRootDir: path.resolve(appdir.PATH, 'custom'),
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.application).to.have.property('port');
        done();
      });
    });

    it('supports `dsRootDir` option', function(done) {
      appdir.createConfigFilesSync();

      var customDir = path.resolve(appdir.PATH, 'custom');
      fs.mkdirsSync(customDir);
      fs.renameSync(
        path.resolve(appdir.PATH, 'datasources.json'),
        path.resolve(customDir, 'datasources.json'));

      boot.compile({
        appRootDir: appdir.PATH,
        dsRootDir: path.resolve(appdir.PATH, 'custom'),
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.dataSources).to.have.property('db');
        done();
      });
    });

    it('supports `modelsRootDir` option', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('custom/model-config.json', {
        foo: {dataSource: 'db'},
      });

      boot.compile({
        appRootDir: appdir.PATH,
        modelsRootDir: path.resolve(appdir.PATH, 'custom'),
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.have.property('name', 'foo');
        done();
      });
    });

    it('includes boot/*.js scripts', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('supports `bootDirs` option', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      boot.compile({
        appRootDir: appdir.PATH,
        bootDirs: [path.dirname(initJs)],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('should resolve relative path in `bootDirs`', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      boot.compile({
        appRootDir: appdir.PATH,
        bootDirs: ['./custom-boot'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('should resolve non-relative path in `bootDirs`', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js', '');
      boot.compile({
        appRootDir: appdir.PATH,
        bootDirs: ['custom-boot'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('ignores index.js in `bootDirs`', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('custom-boot/index.js', '');
      boot.compile({
        appRootDir: appdir.PATH,
        bootDirs: ['./custom-boot'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.have.length(0);
        done();
      });
    });

    it('prefers coffeescript over json in `appRootDir/bootDir`',
      function(done) {
        appdir.createConfigFilesSync();
        var coffee = appdir.writeFileSync('./custom-boot/init.coffee', '');
        appdir.writeFileSync('./custom-boot/init.json', {});

        boot.compile({
          appRootDir: appdir.PATH,
          bootDirs: ['./custom-boot'],
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.bootScripts).to.eql([coffee]);
          done();
        });
      });

    it('prefers coffeescript over json in `bootDir` non-relative path',
      function(done) {
        appdir.createConfigFilesSync();
        var coffee = appdir.writeFileSync('custom-boot/init.coffee',
          '');
        appdir.writeFileSync('custom-boot/init.json', '');

        boot.compile({
          appRootDir: appdir.PATH,
          bootDirs: ['custom-boot'],
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.bootScripts).to.eql([coffee]);
          done();
        });
      });

    it('supports `bootScripts` option', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: [initJs],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('should remove duplicate scripts', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      boot.compile({
        appRootDir: appdir.PATH,
        bootDirs: [path.dirname(initJs)],
        bootScripts: [initJs],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('should resolve relative path in `bootScripts`', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js',
        'module.exports = function(app) { app.fnCalled = true; };');
      boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['./custom-boot/init.js'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('should resolve non-relative path in `bootScripts`', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js', '');
      boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['custom-boot/init.js'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('resolves missing extensions in `bootScripts`', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('custom-boot/init.js', '');
      boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['./custom-boot/init'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('resolves missing extensions in `bootScripts` in module relative path',
      function(done) {
        appdir.createConfigFilesSync();
        var initJs = appdir.writeFileSync(
          'node_modules/custom-boot/init.js', '');

        boot.compile({
          appRootDir: appdir.PATH,
          bootScripts: ['custom-boot/init'],
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.bootScripts).to.eql([initJs]);
          done();
        });
      });

    it('resolves module relative path for `bootScripts`', function(done) {
      appdir.createConfigFilesSync();
      var initJs = appdir.writeFileSync('node_modules/custom-boot/init.js', '');
      boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['custom-boot/init.js'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([initJs]);
        done();
      });
    });

    it('explores `bootScripts` in app relative path', function(done) {
      appdir.createConfigFilesSync();
      var appJs = appdir.writeFileSync('./custom-boot/init.js', '');

      appdir.writeFileSync('node_modules/custom-boot/init.js', '');

      boot.compile({
        appRootDir: appdir.PATH,
        bootScripts: ['custom-boot/init.js'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.bootScripts).to.eql([appJs]);
        done();
      });
    });

    it('ignores models/ subdirectory', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeFileSync('models/my-model.js', '');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.bootScripts).to.not.have.property('models');
        done();
      });
    });

    it('throws when models-config.json contains 1.x `properties`',
      function(done) {
        appdir.createConfigFilesSync({}, {}, {
          foo: {properties: {name: 'string'}},
        });

        expectCompileToThrow(/unsupported 1\.x format/, done);
      });

    it('throws when model-config.json contains 1.x `options.base`',
      function(done) {
        appdir.createConfigFilesSync({}, {}, {
          Customer: {options: {base: 'User'}},
        });

        expectCompileToThrow(/unsupported 1\.x format/, done);
      });

    it('loads models from `./models`', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('models/car.json', {name: 'Car'});
      appdir.writeFileSync('models/car.js', '');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.eql({
          name: 'Car',
          config: {
            dataSource: 'db',
          },
          definition: {
            name: 'Car',
          },
          sourceFile: path.resolve(appdir.PATH, 'models', 'car.js'),
        });
        done();
      });
    });

    it('loads coffeescript models from `./models`', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('models/car.json', {name: 'Car'});
      appdir.writeFileSync('models/car.coffee', '');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.eql({
          name: 'Car',
          config: {
            dataSource: 'db',
          },
          definition: {
            name: 'Car',
          },
          sourceFile: path.resolve(appdir.PATH, 'models', 'car.coffee'),
        });
        done();
      });
    });

    it('supports `modelSources` option', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('custom-models/car.json', {name: 'Car'});
      appdir.writeFileSync('custom-models/car.js', '');

      boot.compile({
        appRootDir: appdir.PATH,
        modelSources: ['./custom-models'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.eql({
          name: 'Car',
          config: {
            dataSource: 'db',
          },
          definition: {
            name: 'Car',
          },
          sourceFile: path.resolve(appdir.PATH, 'custom-models', 'car.js'),
        });
        done();
      });
    });

    it('supports `sources` option in `model-config.json`', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        _meta: {
          sources: ['./custom-models'],
        },
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('custom-models/car.json', {name: 'Car'});
      appdir.writeFileSync('custom-models/car.js', '');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.eql({
          name: 'Car',
          config: {
            dataSource: 'db',
          },
          definition: {
            name: 'Car',
          },
          sourceFile: path.resolve(appdir.PATH, 'custom-models', 'car.js'),
        });
        done();
      });
    });

    it('supports sources relative to node_modules', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        User: {dataSource: 'db'},
      });

      boot.compile({
        appRootDir: appdir.PATH,
        modelSources: [
          'loopback/common/models',
          'loopback/common/dir-does-not-exist',
        ],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0]).to.eql({
          name: 'User',
          config: {
            dataSource: 'db',
          },
          definition: require('loopback/common/models/user.json'),
          sourceFile: require.resolve('loopback/common/models/user.js'),
        });
        done();
      });
    });

    it('resolves relative path in `modelSources` option', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('custom-models/car.json', {name: 'Car'});
      var appJS = appdir.writeFileSync('custom-models/car.js', '');

      boot.compile({
        appRootDir: appdir.PATH,
        modelSources: ['./custom-models'],
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.have.length(1);
        expect(instructions.models[0].sourceFile).to.equal(appJS);
        done();
      });
    });

    it('resolves module relative path in `modelSources` option',
      function(done) {
        appdir.createConfigFilesSync({}, {}, {
          Car: {dataSource: 'db'},
        });
        appdir.writeConfigFileSync('node_modules/custom-models/car.json',
          {name: 'Car'});
        var appJS = appdir.writeFileSync(
          'node_modules/custom-models/car.js', '');

        boot.compile({
          appRootDir: appdir.PATH,
          modelSources: ['custom-models'],
        }, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.models).to.have.length(1);
          expect(instructions.models[0].sourceFile).to.equal(appJS);
          done();
        });
      });

    it('resolves relative path in `sources` option in `model-config.json`',
      function(done) {
        appdir.createConfigFilesSync({}, {}, {
          _meta: {
            sources: ['./custom-models'],
          },
          Car: {dataSource: 'db'},
        });
        appdir.writeConfigFileSync('custom-models/car.json', {name: 'Car'});
        var appJS = appdir.writeFileSync('custom-models/car.js', '');

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.models).to.have.length(1);
          expect(instructions.models[0].sourceFile).to.equal(appJS);
          done();
        });
      });

    it('resolves module relative path in `sources` option in model-config.json',
      function(done) {
        appdir.createConfigFilesSync({}, {}, {
          _meta: {
            sources: ['custom-models'],
          },
          Car: {dataSource: 'db'},
        });
        appdir.writeConfigFileSync('node_modules/custom-models/car.json',
          {name: 'Car'});

        var appJS = appdir.writeFileSync(
          'node_modules/custom-models/car.js', '');

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.models).to.have.length(1);
          expect(instructions.models[0].sourceFile).to.equal(appJS);
          done();
        });
      });

    it('handles model definitions with no code', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('models/car.json', {name: 'Car'});

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.eql([{
          name: 'Car',
          config: {
            dataSource: 'db',
          },
          definition: {
            name: 'Car',
          },
          sourceFile: undefined,
        }]);
        done();
      });
    });

    it('excludes models not listed in `model-config.json`', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('models/car.json', {name: 'Car'});
      appdir.writeConfigFileSync('models/bar.json', {name: 'Bar'});

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var models = instructions.models.map(getNameProperty);
        expect(models).to.eql(['Car']);
        done();
      });
    });

    it('includes models used as Base models', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('models/car.json', {
        name: 'Car',
        base: 'Vehicle',
      });
      appdir.writeConfigFileSync('models/vehicle.json', {
        name: 'Vehicle',
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        var models = instructions.models;
        var modelNames = models.map(getNameProperty);

        expect(modelNames).to.eql(['Vehicle', 'Car']);
        expect(models[0].config).to.equal(undefined);
        done();
      });
    });

    it('excludes pre-built base models', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('models/car.json', {
        name: 'Car',
        base: 'Model',
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var modelNames = instructions.models.map(getNameProperty);
        expect(modelNames).to.eql(['Car']);
        done();
      });
    });

    it('sorts models, base models first', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Vehicle: {dataSource: 'db'},
        FlyingCar: {dataSource: 'db'},
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('models/car.json', {
        name: 'Car',
        base: 'Vehicle',
      });
      appdir.writeConfigFileSync('models/vehicle.json', {
        name: 'Vehicle',
      });
      appdir.writeConfigFileSync('models/flying-car.json', {
        name: 'FlyingCar',
        base: 'Car',
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var modelNames = instructions.models.map(getNameProperty);
        expect(modelNames).to.eql(['Vehicle', 'Car', 'FlyingCar']);
        done();
      });
    });

    it('detects circular Model dependencies', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Vehicle: {dataSource: 'db'},
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('models/car.json', {
        name: 'Car',
        base: 'Vehicle',
      });
      appdir.writeConfigFileSync('models/vehicle.json', {
        name: 'Vehicle',
        base: 'Car',
      });

      expectCompileToThrow(/cyclic dependency/i, done);
    });

    it('uses file name as default value for model name', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        Car: {dataSource: 'db'},
      });
      appdir.writeConfigFileSync('models/car.json', {});

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var modelNames = instructions.models.map(getNameProperty);
        expect(modelNames).to.eql(['Car']);
        done();
      });
    });

    it('uses `OrderItem` as default model name for file with name `order-item`',
      function(done) {
        appdir.createConfigFilesSync({}, {}, {
          OrderItem: {dataSource: 'db'},
        });
        appdir.writeConfigFileSync('models/order-item.json', {});

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          var modelNames = instructions.models.map(getNameProperty);
          expect(modelNames).to.eql(['OrderItem']);
          done();
        });
      });

    it('uses `OrderItem` as default model name for file with name `order_item`',
      function(done) {
        appdir.createConfigFilesSync({}, {}, {
          OrderItem: {dataSource: 'db'},
        });
        appdir.writeConfigFileSync('models/order_item.json', {});

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          var modelNames = instructions.models.map(getNameProperty);
          expect(modelNames).to.eql(['OrderItem']);
          done();
        });
      });

    it('uses `OrderItem` as default model name for file with name `order item`',
      function(done) {
        appdir.createConfigFilesSync({}, {}, {
          OrderItem: {dataSource: 'db'},
        });
        appdir.writeConfigFileSync('models/order item.json', {});

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          var modelNames = instructions.models.map(getNameProperty);
          expect(modelNames).to.eql(['OrderItem']);
          done();
        });
      });

    it('overrides `default model name` by `name` in model definition',
      function(done) {
        appdir.createConfigFilesSync({}, {}, {
          overrideCar: {dataSource: 'db'},
        });
        appdir.writeConfigFileSync('models/car.json', {name: 'overrideCar'});

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          var modelNames = instructions.models.map(getNameProperty);
          expect(modelNames).to.eql(['overrideCar']);
          done();
        });
      });

    it('overwrites model with same default name', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        'OrderItem': {dataSource: 'db'},
      });

      appdir.writeConfigFileSync('models/order-item.json', {
        properties: {
          price: {type: 'number'},
        },
      });
      appdir.writeFileSync('models/order-item.js', '');

      appdir.writeConfigFileSync('models/orderItem.json', {
        properties: {
          quantity: {type: 'number'},
        },
      });
      var appJS = appdir.writeFileSync('models/orderItem.js', '');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.eql([{
          name: 'OrderItem',
          config: {
            dataSource: 'db',
          },
          definition: {
            name: 'OrderItem',
            properties: {
              quantity: {type: 'number'},
            },
          },
          sourceFile: appJS,
        }]);
        done();
      });
    });

    it('overwrites model with same name in model definition', function(done) {
      appdir.createConfigFilesSync({}, {}, {
        'customOrder': {dataSource: 'db'},
      });

      appdir.writeConfigFileSync('models/order1.json', {
        name: 'customOrder',
        properties: {
          price: {type: 'number'},
        },
      });
      appdir.writeFileSync('models/order1.js', '');

      appdir.writeConfigFileSync('models/order2.json', {
        name: 'customOrder',
        properties: {
          quantity: {type: 'number'},
        },
      });
      var appJS = appdir.writeFileSync('models/order2.js', '');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.models).to.eql([{
          name: 'customOrder',
          config: {
            dataSource: 'db',
          },
          definition: {
            name: 'customOrder',
            properties: {
              quantity: {type: 'number'},
            },
          },
          sourceFile: appJS,
        }]);
        done();
      });
    });

    it('returns a new copy of JSON data', function(done) {
      appdir.createConfigFilesSync();

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        instructions.application.modified = true;

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;
          expect(instructions.application).to.not.have.property('modified');
          done();
        });
      });
    });

    describe('for mixins', function() {
      describe(' - mixinDirs', function(done) {
        function verifyMixinIsFoundViaMixinDirs(sourceFile, mixinDirs, done) {
          var appJS = appdir.writeFileSync(sourceFile, '');

          boot.compile({
            appRootDir: appdir.PATH,
            mixinDirs: mixinDirs,
          }, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;
            expect(instructions.mixins[0].sourceFile).to.eql(appJS);
            done();
          });
        }

        it('supports `mixinDirs` option', function(done) {
          verifyMixinIsFoundViaMixinDirs('custom-mixins/other.js',
            ['./custom-mixins'], done);
        });

        it('resolves relative path in `mixinDirs` option', function(done) {
          verifyMixinIsFoundViaMixinDirs('custom-mixins/other.js',
            ['./custom-mixins'], done);
        });

        it('resolves module relative path in `mixinDirs` option',
          function(done) {
            verifyMixinIsFoundViaMixinDirs(
              'node_modules/custom-mixins/other.js',
              ['custom-mixins'], done);
          });
      });

      describe(' - mixinSources', function() {
        beforeEach(function() {
          appdir.createConfigFilesSync({}, {}, {
            Car: {dataSource: 'db'},
          });
          appdir.writeConfigFileSync('models/car.json', {
            name: 'Car',
            mixins: {'TimeStamps': {}},
          });
        });

        function verifyMixinIsFoundViaMixinSources(sourceFile, mixinSources,
                                                   done) {
          var appJS = appdir.writeFileSync(sourceFile, '');

          boot.compile({
            appRootDir: appdir.PATH,
            mixinSources: mixinSources,
          }, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;
            expect(instructions.mixins[0].sourceFile).to.eql(appJS);
            done();
          });
        }

        it('supports `mixinSources` option', function(done) {
          verifyMixinIsFoundViaMixinSources('mixins/time-stamps.js',
            ['./mixins'], done);
        });

        it('resolves relative path in `mixinSources` option', function(done) {
          verifyMixinIsFoundViaMixinSources('custom-mixins/time-stamps.js',
            ['./custom-mixins'], done);
        });

        it('resolves module relative path in `mixinSources` option',
          function(done) {
            verifyMixinIsFoundViaMixinSources(
              'node_modules/custom-mixins/time-stamps.js',
              ['custom-mixins'], done);
          });

        it('supports `mixins` option in `model-config.json`', function(done) {
          appdir.createConfigFilesSync({}, {}, {
            _meta: {
              mixins: ['./custom-mixins'],
            },
            Car: {
              dataSource: 'db',
            },
          });

          var appJS = appdir.writeFileSync('custom-mixins/time-stamps.js', '');
          boot.compile(appdir.PATH, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;
            expect(instructions.mixins[0].sourceFile).to.eql(appJS);
            done();
          });
        });

        it('sets by default `mixinSources` to `mixins` directory',
          function(done) {
            var appJS = appdir.writeFileSync('mixins/time-stamps.js', '');
            boot.compile(appdir.PATH, function(err, context) {
              if (err) return done(err);
              var instructions = context.instructions;
              expect(instructions.mixins[0].sourceFile).to.eql(appJS);
              done();
            });
          });

        it('loads only mixins used by models', function(done) {
          var appJS = appdir.writeFileSync('mixins/time-stamps.js', '');
          appdir.writeFileSync('mixins/foo.js', '');

          boot.compile(appdir.PATH, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;
            expect(instructions.mixins).to.have.length(1);
            expect(instructions.mixins[0].sourceFile).to.eql(appJS);
            done();
          });
        });

        it('loads mixins from model using mixin name in JSON file',
          function(done) {
            var appJS = appdir.writeFileSync('mixins/time-stamps.js', '');
            appdir.writeConfigFileSync('mixins/time-stamps.json', {
              name: 'Timestamping',
            });

            appdir.writeConfigFileSync('models/car.json', {
              name: 'Car',
              mixins: {'Timestamping': {}},
            });

            boot.compile(appdir.PATH, function(err, context) {
              if (err) return done(err);
              var instructions = context.instructions;
              expect(instructions.mixins).to.have.length(1);
              expect(instructions.mixins[0].sourceFile).to.eql(appJS);
              done();
            });
          });

        it('loads mixin only once for dirs common to mixinDirs & mixinSources',
          function(done) {
            var appJS = appdir.writeFileSync(
              'custom-mixins/time-stamps.js', '');

            var options = {
              appRootDir: appdir.PATH,
              mixinDirs: ['./custom-mixins'],
              mixinSources: ['./custom-mixins'],
            };

            boot.compile(options, function(err, context) {
              if (err) return done(err);
              var instructions = context.instructions;
              expect(instructions.mixins).to.have.length(1);
              expect(instructions.mixins[0].sourceFile).to.eql(appJS);
              done();
            });
          });

        it('loads mixin from mixinSources, when it is also found in mixinDirs',
          function(done) {
            appdir.writeFileSync('mixinDir/time-stamps.js', '');
            var appJS = appdir.writeFileSync('mixinSource/time-stamps.js', '');

            var options = {
              appRootDir: appdir.PATH,
              mixinDirs: ['./mixinDir'],
              mixinSources: ['./mixinSource'],
            };

            boot.compile(options, function(err, context) {
              if (err) return done(err);
              var instructions = context.instructions;
              expect(instructions.mixins).to.have.length(1);
              expect(instructions.mixins[0].sourceFile).to.eql(appJS);
              done();
            });
          });

        it('loads mixin from the most recent mixin definition',
          function(done) {
            appdir.writeFileSync('mixins1/time-stamps.js', '');
            var mixins2 = appdir.writeFileSync('mixins2/time-stamps.js', '');

            var options = {
              appRootDir: appdir.PATH,
              mixinSources: ['./mixins1', './mixins2'],
            };

            boot.compile(options, function(err, context) {
              if (err) return done(err);
              var instructions = context.instructions;
              expect(instructions.mixins).to.have.length(1);
              expect(instructions.mixins[0].sourceFile).to.eql(mixins2);
              done();
            });
          });
      });

      describe('name normalization', function() {
        var options;
        beforeEach(function() {
          options = {appRootDir: appdir.PATH, mixinDirs: ['./custom-mixins']};

          appdir.writeFileSync('custom-mixins/foo.js', '');
          appdir.writeFileSync('custom-mixins/time-stamps.js', '');
          appdir.writeFileSync('custom-mixins/camelCase.js', '');
          appdir.writeFileSync('custom-mixins/PascalCase.js', '');
          appdir.writeFileSync('custom-mixins/space name.js', '');
        });

        it('supports classify', function(done) {
          options.normalization = 'classify';
          boot.compile(options, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;

            var mixins = instructions.mixins;
            var mixinNames = mixins.map(getNameProperty);

            expect(mixinNames).to.eql([
              'CamelCase', 'Foo', 'PascalCase', 'SpaceName', 'TimeStamps',
            ]);
            done();
          });
        });

        it('supports dasherize', function(done) {
          options.normalization = 'dasherize';
          boot.compile(options, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;

            var mixins = instructions.mixins;
            var mixinNames = mixins.map(getNameProperty);

            expect(mixinNames).to.eql([
              'camel-case', 'foo', 'pascal-case', 'space-name', 'time-stamps',
            ]);
            done();
          });
        });

        it('supports custom function', function(done) {
          var normalize = function(name) {
            return name.toUpperCase();
          };
          options.normalization = normalize;
          boot.compile(options, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;

            var mixins = instructions.mixins;
            var mixinNames = mixins.map(getNameProperty);

            expect(mixinNames).to.eql([
              'CAMELCASE', 'FOO', 'PASCALCASE', 'SPACE NAME', 'TIME-STAMPS',
            ]);
            done();
          });
        });

        it('supports none', function(done) {
          options.normalization = 'none';
          boot.compile(options, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;

            var mixins = instructions.mixins;
            var mixinNames = mixins.map(getNameProperty);

            expect(mixinNames).to.eql([
              'camelCase', 'foo', 'PascalCase', 'space name', 'time-stamps',
            ]);
            done();
          });
        });

        it('supports false', function(done) {
          options.normalization = false;
          boot.compile(options, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;

            var mixins = instructions.mixins;
            var mixinNames = mixins.map(getNameProperty);

            expect(mixinNames).to.eql([
              'camelCase', 'foo', 'PascalCase', 'space name', 'time-stamps',
            ]);
            done();
          });
        });

        it('defaults to classify', function(done) {
          boot.compile(options, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;

            var mixins = instructions.mixins;
            var mixinNames = mixins.map(getNameProperty);

            expect(mixinNames).to.eql([
              'CamelCase', 'Foo', 'PascalCase', 'SpaceName', 'TimeStamps',
            ]);
            done();
          });
        });

        it('throws error for invalid normalization format', function(done) {
          options.normalization = 'invalidFormat';

          expectCompileToThrow(/Invalid normalization format - "invalidFormat"/,
            options, done);
        });
      });

      it('overrides default mixin name, by `name` in JSON', function(done) {
        appdir.writeFileSync('mixins/foo.js', '');
        appdir.writeConfigFileSync('mixins/foo.json', {name: 'fooBar'});

        var options = {
          appRootDir: appdir.PATH,
          mixinDirs: ['./mixins'],
        };
        boot.compile(options, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.mixins[0].name).to.eql('fooBar');
          done();
        });
      });

      it('extends definition from JSON with same file name', function(done) {
        var appJS = appdir.writeFileSync('custom-mixins/foo-bar.js', '');

        appdir.writeConfigFileSync('custom-mixins/foo-bar.json', {
          description: 'JSON file name same as JS file name',
        });
        appdir.writeConfigFileSync('custom-mixins/FooBar.json', {
          description: 'JSON file name same as normalized name of mixin',
        });

        var options = {
          appRootDir: appdir.PATH,
          mixinDirs: ['./custom-mixins'],
          normalization: 'classify',
        };
        boot.compile(options, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.mixins).to.eql([
            {
              name: 'FooBar',
              description: 'JSON file name same as JS file name',
              sourceFile: appJS,
            },
          ]);
        });
        done();
      });
    });
  });

  describe('for middleware', function() {
    function testMiddlewareRegistration(middlewareId, sourceFile, done) {
      var json = {
        initial: {},
        custom: {},
      };

      json.custom[middlewareId] = {
        params: 'some-config-data',
      };

      appdir.writeConfigFileSync('middleware.json', json);

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware).to.eql({
          phases: ['initial', 'custom'],
          middleware: [
            {
              sourceFile: sourceFile,
              config: {
                phase: 'custom',
                params: 'some-config-data',
              },
            },
          ],
        });
        done();
      });
    }

    var sourceFileForUrlNotFound;
    beforeEach(function() {
      fs.copySync(SIMPLE_APP, appdir.PATH);
      sourceFileForUrlNotFound = require.resolve(
        'loopback/server/middleware/url-not-found');
    });

    it('emits middleware instructions', function(done) {
      testMiddlewareRegistration('loopback/server/middleware/url-not-found',
        sourceFileForUrlNotFound, done);
    });

    it('emits middleware instructions for fragment', function(done) {
      testMiddlewareRegistration('loopback#url-not-found',
        sourceFileForUrlNotFound, done);
    });

    it('supports `middlewareRootDir` option', function(done) {
      var middlewareJson = {
        initial: {},
        custom: {
          'loopback/server/middleware/url-not-found': {
            params: 'some-config-data',
          },
        },
      };
      var customDir = path.resolve(appdir.PATH, 'custom');
      fs.mkdirsSync(customDir);
      fs.writeJsonSync(path.resolve(customDir, 'middleware.json'),
        middlewareJson);
      boot.compile({
        appRootDir: appdir.PATH,
        middlewareRootDir: customDir,
      }, function(err, context) {
        var instructions = context.instructions;
        expect(instructions.middleware).to.eql({
          phases: ['initial', 'custom'],
          middleware: [
            {
              sourceFile: sourceFileForUrlNotFound,
              config: {
                phase: 'custom',
                params: 'some-config-data',
              },
            },
          ],
        });
        done();
      });
    });

    it('fails when a module middleware cannot be resolved', function(done) {
      appdir.writeConfigFileSync('middleware.json', {
        final: {
          'loopback/path-does-not-exist': {},
        },
      });

      expectCompileToThrow(/path-does-not-exist/, done);
    });

    it('does not fail when an optional middleware cannot be resolved',
      function(done) {
        appdir.writeConfigFileSync('middleware.json', {
          final: {
            'loopback/path-does-not-exist': {
              optional: 'this middleware is optional',
            },
          },
        });

        expectCompileToNotThrow(done);
      });

    it('fails when a module middleware fragment cannot be resolved',
      function(done) {
        appdir.writeConfigFileSync('middleware.json', {
          final: {
            'loopback#path-does-not-exist': {},
          },
        });

        expectCompileToThrow(/path-does-not-exist/, done);
      });

    it('does not fail when an optional middleware fragment cannot be resolved',
      function(done) {
        appdir.writeConfigFileSync('middleware.json', {
          final: {
            'loopback#path-does-not-exist': {
              optional: 'this middleware is optional',
            },
          },
        });

        expectCompileToNotThrow(done);
      });

    it('resolves paths relatively to appRootDir', function(done) {
      appdir.writeFileSync('my-middleware.js', '');
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          // resolves to ./my-middleware.js
          './my-middleware': {},
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware).to.eql({
          phases: ['routes'],
          middleware: [{
            sourceFile: path.resolve(appdir.PATH, 'my-middleware.js'),
            config: {phase: 'routes'},
          }],
        });
        done();
      });
    });

    it('merges config.params', function(done) {
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          './middleware': {
            params: {
              key: 'initial value',
            },
          },
        },
      });

      appdir.writeConfigFileSync('./middleware.local.json', {
        routes: {
          './middleware': {
            params: {
              key: 'custom value',
            },
          },
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expectFirstMiddlewareParams(instructions).to.eql({
          key: 'custom value',
        });
        done();
      });
    });

    it('merges config.enabled', function(done) {
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          './middleware': {
            params: {
              key: 'initial value',
            },
          },
        },
      });

      appdir.writeConfigFileSync('./middleware.local.json', {
        routes: {
          './middleware': {
            enabled: false,
          },
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware[0].config)
          .to.have.property('enabled', false);
        done();
      });
    });

    function verifyMiddlewareConfig(done) {
      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware)
          .to.eql([
            {
              sourceFile: path.resolve(appdir.PATH, 'middleware'),
              config: {
                phase: 'routes',
                params: {
                  key: 'initial value',
                },
              },
            },
            {
              sourceFile: path.resolve(appdir.PATH, 'middleware'),
              config: {
                phase: 'routes',
                params: {
                  key: 'custom value',
                },
              },
            },
          ]);
        done();
      });
    }

    it('merges config.params array to array', function(done) {
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          './middleware': [{
            params: {
              key: 'initial value',
            },
          }],
        },
      });

      appdir.writeConfigFileSync('./middleware.local.json', {
        routes: {
          './middleware': [{
            params: {
              key: 'custom value',
            },
          }],
        },
      });

      verifyMiddlewareConfig(done);
    });

    it('merges config.params array to object', function(done) {
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          './middleware': {
            params: {
              key: 'initial value',
            },
          },
        },
      });

      appdir.writeConfigFileSync('./middleware.local.json', {
        routes: {
          './middleware': [{
            params: {
              key: 'custom value',
            },
          }],
        },
      });

      verifyMiddlewareConfig(done);
    });

    it('merges config.params object to array', function(done) {
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          './middleware': [{
            params: {
              key: 'initial value',
            },
          }],
        },
      });

      appdir.writeConfigFileSync('./middleware.local.json', {
        routes: {
          './middleware': {
            params: {
              key: 'custom value',
            },
          },
        },
      });

      verifyMiddlewareConfig(done);
    });

    it('merges config.params array to empty object', function(done) {
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          './middleware': {},
        },
      });

      appdir.writeConfigFileSync('./middleware.local.json', {
        routes: {
          './middleware': [{
            params: {
              key: 'custom value',
            },
          }],
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware)
          .to.eql([
            {
              sourceFile: path.resolve(appdir.PATH, 'middleware'),
              config: {
                phase: 'routes',
                params: {
                  key: 'custom value',
                },
              },
            },
          ]);
      });
      done();
    });

    it('merges config.params array to array by name', function(done) {
      appdir.writeConfigFileSync('./middleware.json', {
        routes: {
          './middleware': [{
            name: 'a',
            params: {
              key: 'initial value',
            },
          }],
        },
      });

      appdir.writeConfigFileSync('./middleware.local.json', {
        routes: {
          './middleware': [{
            name: 'a',
            params: {
              key: 'custom value',
            },
          }, {
            params: {
              key: '2nd value',
            },
          }],
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware)
          .to.eql([
            {
              sourceFile: path.resolve(appdir.PATH, 'middleware'),
              config: {
                name: 'a',
                phase: 'routes',
                params: {
                  key: 'custom value',
                },
              },
            },
            {
              sourceFile: path.resolve(appdir.PATH, 'middleware'),
              config: {
                phase: 'routes',
                params: {
                  key: '2nd value',
                },
              },
            },
          ]);
        done();
      });
    });

    it('flattens sub-phases', function(done) {
      appdir.writeConfigFileSync('middleware.json', {
        'initial:after': {},
        'custom:before': {
          'loopback/server/middleware/url-not-found': {
            params: 'some-config-data',
          },
        },
        'custom:after': {},
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.phases, 'phases')
          .to.eql(['initial', 'custom']);
        expect(instructions.middleware.middleware, 'middleware')
          .to.eql([{
            sourceFile: require.resolve(
              'loopback/server/middleware/url-not-found'),
            config: {
              phase: 'custom:before',
              params: 'some-config-data',
            },
          }]);
        done();
      });
    });

    it('supports multiple instances of the same middleware', function(done) {
      appdir.writeFileSync('my-middleware.js', '');
      appdir.writeConfigFileSync('middleware.json', {
        'final': {
          './my-middleware': [
            {
              params: 'first',
            },
            {
              params: 'second',
            },
          ],
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware)
          .to.eql([
            {
              sourceFile: path.resolve(appdir.PATH, 'my-middleware.js'),
              config: {
                phase: 'final',
                params: 'first',
              },
            },
            {
              sourceFile: path.resolve(appdir.PATH, 'my-middleware.js'),
              config: {
                phase: 'final',
                params: 'second',
              },
            },
          ]);
        done();
      });
    });

    it('supports shorthand notation for middleware paths', function(done) {
      appdir.writeConfigFileSync('middleware.json', {
        'final': {
          'loopback#url-not-found': {},
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware[0].sourceFile).to.equal(
          require.resolve('loopback/server/middleware/url-not-found'));
        done();
      });
    });

    it('supports shorthand notation for relative paths', function(done) {
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          './middleware/index#myMiddleware': {},
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware[0].sourceFile)
          .to.equal(path.resolve(appdir.PATH,
          './middleware/index.js'));
        expect(instructions.middleware.middleware[0]).have.property(
          'fragment',
          'myMiddleware');
        done();
      });
    });

    it('supports shorthand notation when the fragment name matches a property',
      function(done) {
        appdir.writeConfigFileSync('middleware.json', {
          'final': {
            'loopback#errorHandler': {},
          },
        });

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.middleware.middleware[0]).have.property(
            'sourceFile',
            pathWithoutIndex(require.resolve('loopback')));
          expect(instructions.middleware.middleware[0]).have.property(
            'fragment',
            'errorHandler');
          done();
        });
      });

    it('resolves modules relative to appRootDir', function(done) {
      var HANDLER_FILE = 'node_modules/handler/index.js';
      appdir.writeFileSync(
        HANDLER_FILE,
        'module.exports = function(req, res, next) { next(); }');

      appdir.writeConfigFileSync('middleware.json', {
        'initial': {
          'handler': {},
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware[0]).have.property(
          'sourceFile',
          pathWithoutIndex(appdir.resolve(HANDLER_FILE)));
        done();
      });
    });

    it('prefers appRootDir over node_modules for middleware', function(done) {
      var appJS = appdir.writeFileSync('./my-middleware.js', '');
      appdir.writeFileSync('node_modules/my-middleware.js', '');
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          './my-middleware': {},
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware).to.have.length(1);
        expect(instructions.middleware.middleware[0]).have.property(
          'sourceFile', appJS);
        done();
      });
    });

    it('does not treat module relative path as `appRootDir` relative',
      function(done) {
        appdir.writeFileSync('./my-middleware.js', '');
        var moduleJS = appdir.writeFileSync(
          'node_modules/my-middleware.js', '');
        appdir.writeConfigFileSync('middleware.json', {
          'routes': {
            'my-middleware': {},
          },
        });

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.middleware.middleware).to.have.length(1);
          expect(instructions.middleware.middleware[0]).have.property(
            'sourceFile', moduleJS);
          done();
        });
      });

    it('loads middleware from coffeescript in appRootdir', function(done) {
      var coffee = appdir.writeFileSync('my-middleware.coffee', '');
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          './my-middleware': {},
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware[0]).have.property(
          'sourceFile', coffee);
        done();
      });
    });

    it('loads coffeescript from middleware under node_modules',
      function(done) {
        var file = appdir.writeFileSync(
          'node_modules/my-middleware/index.coffee',
          '');
        appdir.writeFileSync('node_modules/my-middleware/index.json', '');
        appdir.writeConfigFileSync('middleware.json', {
          'routes': {
            'my-middleware': {},
          },
        });

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.middleware.middleware).to.have.length(1);
          expect(instructions.middleware.middleware[0]).have.property(
            'sourceFile', pathWithoutIndex(file));
          done();
        });
      });

    it('prefers coffeescript over json for relative middleware path',
      function(done) {
        var coffee = appdir.writeFileSync('my-middleware.coffee', '');
        appdir.writeFileSync('my-middleware.json', '');
        appdir.writeConfigFileSync('middleware.json', {
          'routes': {
            './my-middleware': {},
          },
        });

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.middleware.middleware).to.have.length(1);
          expect(instructions.middleware.middleware[0]).have.property(
            'sourceFile', coffee);
          done();
        });
      });

    it('prefers coffeescript over json for module relative middleware path',
      function(done) {
        var coffee = appdir.writeFileSync('node_modules/my-middleware.coffee',
          '');
        appdir.writeFileSync('node_modules/my-middleware.json', '');
        appdir.writeConfigFileSync('middleware.json', {
          'routes': {
            'my-middleware': {},
          },
        });

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.middleware.middleware).to.have.length(1);
          expect(instructions.middleware.middleware[0]).have.property(
            'sourceFile', coffee);
          done();
        });
      });

    it('ignores sourcmap files when loading middleware',
    function(done) {
      var middleware = appdir.writeFileSync('my-middleware.js',
        '// I am the middleware');
      var sourcemap = appdir.writeFileSync('my-middleware.js.map',
        '// I am a sourcemap');
      appdir.writeConfigFileSync('middleware.json', {
        'routes': {
          './my-middleware': {},
        },
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        expect(instructions.middleware.middleware[0]).have.property(
          'sourceFile', middleware);
        done();
      });
    });

    describe('config with relative paths in params', function() {
      var RELATIVE_PATH_PARAMS = [
        '$!./here',
        '$!../there',
      ];

      var absolutePathParams;
      beforeEach(function resolveRelativePathParams() {
        absolutePathParams = RELATIVE_PATH_PARAMS.map(function(p) {
          return appdir.resolve(p.slice(2));
        });
      });

      it('converts paths in top-level array items', function(done) {
        givenMiddlewareEntrySync({params: RELATIVE_PATH_PARAMS});

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expectFirstMiddlewareParams(instructions)
            .to.eql(absolutePathParams);
          done();
        });
      });

      it('converts paths in top-level object properties', function(done) {
        givenMiddlewareEntrySync({
          params: {
            path: RELATIVE_PATH_PARAMS[0],
          },
        });

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expectFirstMiddlewareParams(instructions)
            .to.eql({path: absolutePathParams[0]});
          done();
        });
      });

      it('converts path value when params is a string', function(done) {
        givenMiddlewareEntrySync({params: RELATIVE_PATH_PARAMS[0]});

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expectFirstMiddlewareParams(instructions)
            .to.eql(absolutePathParams[0]);
          done();
        });
      });

      it('converts paths in nested properties', function(done) {
        givenMiddlewareEntrySync({
          params: {
            nestedObject: {
              path: RELATIVE_PATH_PARAMS[0],
            },
            nestedArray: RELATIVE_PATH_PARAMS,
          },
        });

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expectFirstMiddlewareParams(instructions)
            .to.eql({
              nestedObject: {
                path: absolutePathParams[0],
              },
              nestedArray: absolutePathParams,
            });
          done();
        });
      });

      it('does not convert values not starting with `./` or `../`',
        function(done) {
          var PARAMS = ['$!.somerc', '$!/root', '$!hello!'];
          givenMiddlewareEntrySync({params: PARAMS});

          boot.compile(appdir.PATH, function(err, context) {
            if (err) return done(err);
            var instructions = context.instructions;

            expectFirstMiddlewareParams(instructions).to.eql(PARAMS);
            done();
          });
        });
    });
  });

  describe('for components', function() {
    it('loads component configs from multiple files', function(done) {
      appdir.createConfigFilesSync();
      appdir.writeConfigFileSync('component-config.json', {
        debug: {option: 'value'},
      });
      appdir.writeConfigFileSync('component-config.local.json', {
        debug: {local: 'applied'},
      });

      var env = process.env.NODE_ENV || 'development';
      appdir.writeConfigFileSync('component-config.' + env + '.json', {
        debug: {env: 'applied'},
      });

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var component = instructions.components[0];
        expect(component).to.eql({
          sourceFile: require.resolve('debug'),
          config: {
            option: 'value',
            local: 'applied',
            env: 'applied',
          },
        });
        done();
      });
    });

    it('supports `componentRootDir` option', function(done) {
      var componentJson = {
        debug: {
          option: 'value',
        },
      };
      var customDir = path.resolve(appdir.PATH, 'custom');
      fs.mkdirsSync(customDir);
      fs.writeJsonSync(
        path.resolve(customDir, 'component-config.json'), componentJson);

      boot.compile({
        appRootDir: appdir.PATH,
        componentRootDir: path.resolve(appdir.PATH, 'custom'),
      }, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        var component = instructions.components[0];
        expect(component).to.eql({
          sourceFile: require.resolve('debug'),
          config: {
            option: 'value',
          },
        });
        done();
      });
    });

    it('loads component relative to appRootDir', function(done) {
      appdir.writeConfigFileSync('./component-config.json', {
        './index': {},
      });
      var appJS = appdir.writeConfigFileSync('index.js', '');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.components[0]).have.property(
          'sourceFile', appJS
        );
        done();
      });
    });

    it('loads component relative to node modules', function(done) {
      appdir.writeConfigFileSync('component-config.json', {
        'mycomponent': {},
      });
      var js = appdir.writeConfigFileSync('node_modules/mycomponent/index.js',
        '');

      boot.compile(appdir.PATH, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;
        expect(instructions.components[0]).have.property(
          'sourceFile', js
        );
        done();
      });
    });

    it('retains backward compatibility for non-relative path in `appRootDir`',
      function(done) {
        appdir.writeConfigFileSync('component-config.json', {
          'my-component/component.js': {},
        });
        appdir.writeConfigFileSync('./my-component/component.js', '');

        expectCompileToThrow(
          'Cannot resolve path \"my-component/component.js\"',
          done);
      });

    it('prefers coffeescript over json for relative path component',
      function(done) {
        appdir.writeConfigFileSync('component-config.json', {
          './component': {},
        });

        var coffee = appdir.writeFileSync('component.coffee', '');
        appdir.writeFileSync('component.json', '');

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.components).to.have.length(1);
          expect(instructions.components[0]).have.property(
            'sourceFile', coffee);
          done();
        });
      });

    it('prefers coffeescript over json for module relative component path',
      function(done) {
        appdir.writeConfigFileSync('component-config.json', {
          'component': {},
        });

        var coffee = appdir.writeFileSync('node_modules/component.coffee', '');
        appdir.writeFileSync('node_modules/component.json', '');

        boot.compile(appdir.PATH, function(err, context) {
          if (err) return done(err);
          var instructions = context.instructions;

          expect(instructions.components).to.have.length(1);
          expect(instructions.components[0]).have.property(
            'sourceFile', coffee);
          done();
        });
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
      './middleware': config,
    },
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

