'use strict';

var path = require('path');
var loopback = require('loopback');

var chai = require('chai');
var dirtyChai = require('dirty-chai');
var expect = chai.expect;
chai.use(dirtyChai);

var Bootstrapper = require('../lib/bootstrapper');

describe('Bootstrapper', function() {
  var app;
  beforeEach(function() {
    app = loopback();
    process.bootFlags = [];
  });

  it('should honor options.phases', function(done) {
    var options = {
      app: app,
      appRootDir: path.join(__dirname, './fixtures/simple-app'),
      phases: ['load'],
    };

    var bootstrapper = new Bootstrapper(options);

    var context = {
      app: app,
    };

    bootstrapper.run(context, function(err) {
      if (err) return done(err);
      var configs = context.configurations;
      expect(configs.application, 'application').to.be.an('object');
      expect(configs.bootScripts, 'bootScripts').to.be.an('array');
      expect(configs.middleware, 'middleware').to.be.an('object');
      expect(configs.models, 'models').to.be.an('object');
      expect(configs.tracker, 'tracker').to.eql('load');
      expect(context.instructions, 'instructions').to.be.undefined();
      expect(process.bootFlags.length).to.eql(0);
      done();
    });
  });

  it('should honor options.plugins', function(done) {
    var options = {
      app: app,
      appRootDir: path.join(__dirname, './fixtures/simple-app'),
      plugins: ['application', 'boot-script'],
    };

    var bootstrapper = new Bootstrapper(options);

    var context = {
      app: app,
    };

    bootstrapper.run(context, function(err) {
      if (err) return done(err);
      var configs = context.configurations;
      var instructions = context.instructions;
      expect(configs.application, 'application').to.be.an('object');
      expect(configs.middleware, 'middleware').to.be.undefined();
      expect(configs.models, 'models').to.be.undefined();
      expect(configs.bootScripts, 'bootScripts').to.be.an('array');
      expect(instructions.application, 'application').to.be.an('object');
      expect(instructions.tracker, 'instruction: tracker').to.eql('compile');
      expect(context.executions.tracker, 'execution: tracker').to.eql('start');
      expect(process.bootFlags, 'process: bootFlags').to.eql(['barLoaded',
        'barSyncLoaded',
        'fooLoaded',
        'barStarted',
        'barFinished',
        'barSyncExecuted',
      ]);
      done();
    });
  });

  it('searches boot file extensions specified in options.scriptExtensions',
  function(done) {
    var options = {
      app: app,
      appRootDir: path.join(__dirname, './fixtures/simple-app'),
      scriptExtensions: ['.customjs', '.customjs2'],
    };

    var bootstrapper = new Bootstrapper(options);

    var context = {
      app: app,
    };

    bootstrapper.run(context, function(err) {
      if (err) return done(err);
      expect(process.bootFlags, 'process: bootFlags').to.eql([
        'customjs',
        'customjs2',
      ]);
      done();
    });
  });

  afterEach(function() {
    delete process.bootFlags;
  });
});
