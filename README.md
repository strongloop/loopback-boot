# LoopBack Boot

LoopBack Boot is a convention-based bootstrapper for LoopBack applications.

**For full documentation, see the official StrongLoop documentation:**

 * [Creating a LoopBack application](http://docs.strongloop.com/display/LB/Creating+a+LoopBack+application)

## Installation

    npm install loopback-boot

## Usage

```js
var loopback = require('loopback');
var boot = require('loopback-boot');

var app = loopback();
boot(app, __dirname);

app.use(loopback.rest());
app.listen();
```

See [API docs](http://apidocs.strongloop.com/loopback-boot/#api) for
complete API reference.

## Versions

The version range `1.x` is backwards compatible with `app.boot` provided
by LoopBack 1.x versions and the project layout scaffolded by `slc lb project`
up to slc version 2.5.

The version range `2.x` supports the new project layout as scaffolded by
`yo loopback`.

This document describes the configuration conventions of the `2.x` versions.
See [Migrating from 1.x to 2.x](http://apidocs.strongloop.com/loopback-boot/#migrating-from-1x-to-2x)
for step-by-step instructions on how to upgrade existing projects.

## Configurations and conventions

The bootstrapping process takes care of the following tasks:

 - Configuration of data-sources.
 - Definition of custom Models
 - Configuration of models, attaching models to data-sources.
 - Configuration of app settings like `host`, `port` or `restApiRoot`.
 - Running additional boot scripts, so that the custom setup code can be kept
  in multiple small files as opposed to keeping everything in the main app file.

Below is the typical project layout. See the following sections for description
of the project files.

```
project/
  app.js
  config.json
  datasources.json
  models.json
  models/
  boot/
```

### App settings

The settings are loaded from the file `config.json` in the project root directory
and can be accessed via `app.get('option-name')` from the code.

Additionally, the following files can provide values to override `config.json`:

 - `config.local.js` or `config.local.json`
 - `config.{env}.js` or `config.{env}.json`, where `{env}` is the value of `NODE_ENV`
   (typically `development` or `production`)

**NOTE:** The additional files can override the top-level keys with
value-types (strings, numbers) only. Nested objects and arrays are
not supported at the moment.

#### Example settings

*config.json*

```json
{
  "host": "localhost",
  "port": 3000,
  "restApiRoot": "/api"
}
```

*config.production.js*

```js
module.exports = {
  host: process.env.CUSTOM_HOST,
  port: process.env.CUSTOM_PORT
};
```

### Data sources

The configuration of data sources is loaded from the file `datasources.json`
in the project root directory, the data sources can be accessed via
`app.datasources['datasource-name']` from the code.

Additionally, the following files can provide values to override
`datasources.json`:

 - `datasources.local.js` or `datasources.local.json`
 - `datasources.{env}.js` or `datasources.{env}.json`,
    where `{env}` is the value of `NODE_ENV`
   (typically `development` or `production`)

**NOTE:** The additional files can override the top-level data-source options
with value-types (strings, numbers) only. Nested objects and arrays are
not supported at the moment.

#### Example data sources

*datasources.json*

```js
{
  // the key is the datasource name
  // the value is the config object to pass to
  //   app.dataSource(name, config).
  db: {
    connector: 'memory'
  }
}
```

*datasources.production.json*

```js
{
  db: {
    connector: 'mongodb',
    database: 'myapp',
    user: 'myapp',
    password: 'secret'
  }
}
```

### Models: definition

Custom models are defined using JSON files in `models/` directory,
one JSON file per model.

#### Example models

The following are example JSON files for two `Model` definitions:
`Dealership` and `Location`.

*models/dealership.json*

```js
{
  // the model name
  "name": "Dealership",
  // the options passed to Model.extend(name, properties, options)
  "options": {
    "relations": {
      "cars": {
        "type": "hasMany",
        "model": "Car",
        "foreignKey": "dealerId"
      }
    }
  },
  // the properties passed to Model.extend(name, properties, options)
  "properties": {
    "id": {"id": true},
    "name": "String",
    "zip": "Number",
    "address": "String"
  }
}
```

*models/car.json*
```js
{
  "name": "Car",
  // options can be specified at the top level too
  "relations": {
    "dealer": {
      "type": "belongsTo",
      "model": "Dealership",
      "foreignKey": "dealerId"
    },
  }
  "properties": {
    "id": {
      "type": "String",
      "required": true,
      "id": true
    },
    "make": {
      "type": "String",
      "required": true
    },
    "model": {
      "type": "String",
      "required": true
    }
  }
}
```

#### Adding custom methods to models

The models created from JSON files come with the set of built-in methods
like `find` and `create`. To implement your custom methods, you should
create a javascript file in `models/` directory with the same base-name
as the JSON file containing model definition (e.g. `models/car.js` for
`models/car.json`) and define the methods there.

Example:

*models/car.js*

```js
// Car is the model constructor
// Base is the parent model (e.g. loopback.PersistedModel)
module.exports = function(Car, Base) {
  // Define a static method
  Car.customMethod = function(cb) {
    // do some work
    cb();
  };

  // Define an instance (prototype) method
  Car.prototype.honk = function(duration, cb) {
    // make some noise for `duration` seconds
    cb();
  };

  // Provide a custom setup method
  Car.setup = function() {
    Base.setup.call(this);

    // configure validations,
    // configure remoting for methods, etc.
  };
};
```

### Models: configuration

Before the models can be used in a loopback application, they have to be
configured - attached to a data-source, exposed via the REST API, and so on.

The configuration is described in the file `models.json`:

```js
{
  // the key is the model name
  "Dealership": {
    // a reference, by name, to a dataSource definition
    "dataSource": "my-db"
  },
  "Car": {
    "dataSource": "my-db",
    // do not expose Car over the REST API
    "public": false
  }
}
```

The bootstrapper will automatically load definition of every custom model
configured in `models.json`. By default, the definition files are loaded from
`models/` subdirectory. However, it is possible to specify a different location
(or even multiple locations) via `_meta.sources`:

```js
{
  "_meta": {
    "sources": [
      // all paths are relative to models.json
      "./models"
      "./node_modules/foobar/models"
    ]
  },
  // use the `FooBar` model from the `foobar` module
  "FooBar": {
    "dataSource": "db"
  }
}
```

### Boot scripts

When the data sources and models are configured, the bootstrapper invokes
all scripts in the `boot/` folder. The scripts are sorted lexicographically
ingoring case.

#### Example boot script

*boot/authentication.js*

```js
module.exports = function(app) {
  app.enableAuth();
};
```

## Running in a browser

The bootstrap process is implemented in two steps that can be called
independently.

### Build

The first step loads all configuration files, merges values from additional
config files like `app.local.js` and produces a set of instructions
that can be used to boot the application.

These instructions must be included in the browser bundle together
with all configuration scripts from `models/` and `boot/`.

Don't worry, you don't have to understand these details.
Just call `boot.compileToBrowserify`, it will take care of everything for you.

*build file (Gruntfile.js, gulpfile.js)*

```js
var browserify = require('browserify');
var boot = require('loopback-boot');

var b = browserify({
  basedir: appDir,
});

// add the main application file
b.require('./browser-app.js', { expose: 'loopback-app' });

// add boot instructions
boot.compileToBrowserify(appDir, b);

// create the bundle
var out = fs.createWriteStream('browser-bundle.js');
b.bundle().pipe(out);
// handle out.on('error') and out.on('close')
```

### Run

In the browser, the main application file should call loopback-boot
to setup the loopback application by executing the instructions
contained in the browser bundle:

*browser-app.js*

```js
var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();
boot(app);
```

The app object created above can be accessed via `require('loopback-app')`,
where `loopback-app` is the identifier used for the main app file in
the browserify build shown above.

Here is a simple example demonstrating the concept:

*index.html*

```xml
<script src="app.bundle.js"></script>
<script>
var app = require('loopback-app');
var User = app.models.User;

User.login(
  { email: 'test@example.com', password: '12345' },
  function(err, res) {
    if (err) {
      console.error('Login failed: ', err);
    } else {
      console.log('Logged in.');
    }
  }
);
</script>
```
