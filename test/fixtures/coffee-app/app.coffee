loopback = require 'loopback'
boot = require '../../../'

module.exports = client = loopback()
client.start = (done) ->
  boot(client, __dirname, done)
