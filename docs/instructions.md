## Two-step boot

The methods `compile` and `execute` can be used to split the bootstrap
process into two steps, the first one run by a build script before calling
`browserify`, the second one run in the browser by the browserified app.

The first method - `compile` - loads all configuration files, applies any
values specified in environmental variable and produces one JSON object
containing all instructions needed by `execute` to bootstrap the application.

```js
{
  app: {
   /* application config from app.json & friends */
  },
  models: {
   /* model configuration from models.json */
  },
  dataSources: {
   /* datasources configuration from datasources.json & friends*/
  },
  files: {
    models: [
     '/project/models/customer.js',
      /* ... */
    ],
    boot: [
      '/project/boot/authentication.js',
      /* ... */
    ]
  }
}
```
