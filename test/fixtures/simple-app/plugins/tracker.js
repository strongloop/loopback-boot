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
