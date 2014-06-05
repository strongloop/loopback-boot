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
