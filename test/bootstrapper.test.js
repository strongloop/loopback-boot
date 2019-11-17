// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const path = require('path');
const loopback = require('loopback');

const chai = require('chai');
const dirtyChai = require('dirty-chai');
const expect = chai.expect;
chai.use(dirtyChai);

const Bootstrapper = require('../lib/bootstrapper');

describe('Bootstrapper', function() {
  let app;
  beforeEach(function() {
    app = loopback();
    process.bootFlags = [];
  });

  it('should honor options.phases', function(done) {
    const options = {
      app: app,
      appRootDir: path.join(__dirname, './fixtures/simple-app'),
      phases: ['load'],
    };

    const bootstrapper = new Bootstrapper(options);

    const context = {
      app: app,
    };

    bootstrapper.run(context, function(err) {
      if (err) return done(err);
      const configs = context.configurations;
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
    const options = {
      app: app,
      appRootDir: path.join(__dirname, './fixtures/simple-app'),
      plugins: ['application', 'boot-script'],
    };

    const bootstrapper = new Bootstrapper(options);

    const context = {
      app: app,
    };

    bootstrapper.run(context, function(err) {
      if (err) return done(err);
      const configs = context.configurations;
      const instructions = context.instructions;
      expect(configs.application, 'application').to.be.an('object');
      expect(configs.middleware, 'middleware').to.be.undefined();
      expect(configs.models, 'models').to.be.undefined();
      expect(configs.bootScripts, 'bootScripts').to.be.an('array');
      expect(instructions.application, 'application').to.be.an('object');
      expect(instructions.tracker, 'instruction: tracker').to.eql('compile');
      expect(context.executions.tracker, 'execution: tracker').to.eql('start');
      expect(process.bootFlags, 'process: bootFlags').to.eql([
        'barLoaded',
        'barSyncLoaded',
        'fooLoaded',
        'promiseLoaded',
        'thenableLoaded',
        'barStarted',
        'barFinished',
        'barSyncExecuted',
        'promiseStarted',
        'promiseFinished',
        'thenableStarted',
        'thenableFinished',
        'umdLoaded',
      ]);
      done();
    });
  });

  it('searches boot file extensions specified in options.scriptExtensions',
    function(done) {
      const options = {
        app: app,
        appRootDir: path.join(__dirname, './fixtures/simple-app'),
        scriptExtensions: ['.customjs', '.customjs2'],
      };

      const bootstrapper = new Bootstrapper(options);

      const context = {
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
