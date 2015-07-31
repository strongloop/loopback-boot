var vm = require('vm');

function createContext() {
  var context = {
    // required by browserify
    XMLHttpRequest: function() { throw new Error('not implemented'); },
    FormData: function() { throw new Error('not implemented'); },

    localStorage: {
      // used by `debug` module
      debug: process.env.DEBUG
    },

    // used by DataSource.prototype.ready
    setTimeout: setTimeout,

    // used by `debug` module
    document: { documentElement: { style: {} } },

    // used by `debug` module
    navigator: { userAgent: 'sandbox' },

    // used by crypto-browserify & friends
    Int32Array: Int32Array,
    DataView: DataView,

    // allow the browserified code to log messages
    // call `printContextLogs(context)` to print the accumulated messages
    console: {
      log: function() {
        this._logs.log.push(Array.prototype.slice.call(arguments));
      },
      warn: function() {
        this._logs.warn.push(Array.prototype.slice.call(arguments));
      },
      error: function() {
        this._logs.error.push(Array.prototype.slice.call(arguments));
      },
      _logs: {
        log: [],
        warn: [],
        error: []
      },
    }
  };

  // `window` is used by loopback to detect browser runtime
  context.window = context;

  return vm.createContext(context);
}
exports.createContext = createContext;

function printContextLogs(context) {
  for (var k in context.console._logs) {
    var items = context.console._logs[k];
    for (var ix in items) {
      console[k].apply(console, items[ix]);
    }
  }
}
exports.printContextLogs = printContextLogs;
