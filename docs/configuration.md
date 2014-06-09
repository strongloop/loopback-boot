## Configuration and conventions

### Model Definitions

The following is example JSON for two `Model` definitions:
"dealership" and "location".

```js
{
  "dealership": {
    // a reference, by name, to a dataSource definition
    "dataSource": "my-db",
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
  },
  "car": {
    "dataSource": "my-db"
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
}
```

### Migrating from 1.x to 2.x

**Starting point: a sample 1.x project**

*models.json*

```json
{
  "car": {
    "properties": {
      "color": "string",
    },
    "dataSource": "db"
  }
}
```

*models/car.js*

```js
var app = require('../app');
var Car = app.models.Car;

Car.prototype.honk = function() {
  // make some noise
};
```

*app.js*
```js
var loopback = require('loopback');
var boot = require('loopback-boot');
var app = loopback();
boot(app, __dirname);
```

#### Model definitions &amp; configurations

**The 2.x version of loopback-boot no longer creates Models, it's up to the
developer to create them before booting the app.**

The folder `models/` has a different semantincs in 2.x than in 1.x. Instead
of extending Models already defined by `app.boot` and `models.json`,
it is an encapsulated component that defines all Models independently of
any application that may use them.

Perform the following steps to update a 1.x project for loopback-boot 2.x.
All code samples are referring to the sample project described above.

 1. Move all Model-definition metadata from `models.json`
 to new per-model json files in `models/` directory.

  *models/car.json*

  ```json
    {
      "name": "car",
      "properties": {
        "color": "string",
      }
    }
  ```

  *models.json*

  ```js
    {
      "car": {
        "dataSource": "db"
      }
    }
  ```

 2. Change per-model javascript files to build and export the Model class:

  *models/car.js*

  ```js
    var loopback = require('loopback');
    var Car = module.exports = loopback.createModel(require('./car.json'));

    Car.prototype.honk = function() {
      // make some noise
    };
  ```

 3. Add a new file `models/index.js` to build all models:

 *models/index.js*

 ```js
   exports.Car = require('./car');
 ```

 4. Modify the main application file to load model definitions before booting
 the application.

 ```js
    var loopback = require('loopback');
    var boot = require('loopback-boot');
    require('./models');

    var app = loopback();
    boot(app, __dirname);
  ```

#### Attaching built-in models

Models provided by LoopBack, such as `User` or `Role`, are no longer
automatically attached to default data-sources. The data-source configuration
entry `defaultForType` is silently ignored.

You have to explicitly configure all built-in models used by your application
in the `models.json` file.

```
{
  "Role": { "dataSource": "db" }
}
```
