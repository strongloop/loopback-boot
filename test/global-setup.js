var loopback = require('loopback');

// bootLoopBackApp() calls loopback.autoAttach
// which attempts to attach all models to default datasources
// one of those models is Email which requires 'email' datasource
loopback.setDefaultDataSourceForType('mail', {
  connector: loopback.Mail,
  transports: [
    {type: 'STUB'}
  ]
});
