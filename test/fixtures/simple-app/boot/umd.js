// Copyright IBM Corp. 2014. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// GENERATED CODE
(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    function default_1(app) {
        console.log('UMD Module loaded');
        process.bootFlags.push('umdLoaded');
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = default_1;
});