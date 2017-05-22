// Copyright IBM Corp. 2014. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

module.exports = function(name) {
  return function(req, res, next) {
    req._names = req._names || [];
    req._names.push(name);
    res.setHeader('names', req._names.join(','));
    next();
  };
};
