// Copyright IBM Corp. 2014. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function(Customer) {
  Customer.settings._customized = 'Customer';
  Customer.base.settings._customized = 'Base';
};
