// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

module.exports = function(loopbackApp, params) {
  loopbackApp.use('/component', function(req, res, next) {
    res.send(params);
  });
};
