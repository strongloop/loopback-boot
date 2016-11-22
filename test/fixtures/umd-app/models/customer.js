(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    function default_1(Customer) {
      Customer.settings._customized = 'Customer'
      Customer.base.settings._customized = 'Base'
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = default_1;
});
