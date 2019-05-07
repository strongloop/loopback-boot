// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

module.exports = function(opitions) {
  return new Tracker(opitions);
};

function Tracker(options) {
  this.name = 'tracker';
  this.options = options || {};
}

Tracker.prototype.load = function(context) {
  context.configurations.tracker = 'load';
};

Tracker.prototype.compile = function(context, done) {
  context.instructions.tracker = 'compile';
  process.nextTick(done);
};

Tracker.prototype.start = function(context, done) {
  context.executions = context.executions || {};
  context.executions.tracker = 'start';
  process.nextTick(done);
};
