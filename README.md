# LoopBack Boot

**⚠️ LoopBack 3 is in Maintenance LTS mode, only critical bugs and critical
security fixes will be provided. (See
[Module Long Term Support Policy](#module-long-term-support-policy) below.)**

We urge all LoopBack 3 users to migrate their applications to LoopBack 4 as
soon as possible. Refer to our
[Migration Guide](https://loopback.io/doc/en/lb4/migration-overview.html)
for more information on how to upgrade.

## Overview

A convention-based bootstrapper for LoopBack applications.

For full documentation, see the official StrongLoop documentation: [Defining boot scripts](https://loopback.io/doc/en/lb2/Defining-boot-scripts) and [Creating a LoopBack application](https://loopback.io/doc/en/lb2/Creating-an-application).

The loopback-boot module initializes (bootstraps) a LoopBack application.  Specifically, it:
 - Configures data-sources.
 - Defines custom models
 - Configures models and attaches models to data-sources.
 - Configures application settings
 - Runs additional boot scripts, so you can put custom setup code in multiple small files instead of in the main application file.

For more information, see [Defining boot scripts](https://loopback.io/doc/en/lb2/Defining-boot-scripts).

### Version notes

The version range `1.x` is backwards compatible with `app.boot` provided
by LoopBack 1.x versions and the project layout scaffolded by `slc lb project`
up to slc version 2.5.

The version range `2.x` supports the new project layout as scaffolded by
`yo loopback`.

This document describes the configuration conventions of the `2.x` versions.

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

See [API docs](http://apidocs.strongloop.com/loopback-boot/) for
complete API reference.

## Module Long Term Support Policy

This module adopts the [
Module Long Term Support (LTS)](http://github.com/CloudNativeJS/ModuleLTS) policy,
with the following End Of Life (EOL) dates:

| Version | Status          | Published | EOL      |
| ------- | --------------- | --------- | -------- |
| 3.x     | Maintenance LTS | May 2017  | Dec 2020 |
| 2.x     | End-of-Life     | Jul 2014  | Apr 2019 |

Learn more about our LTS plan in [docs](https://loopback.io/doc/en/contrib/Long-term-support.html).

## License

This module is provided under dual MIT/StrongLoop license.  See [LICENSE](LICENSE) for details.
