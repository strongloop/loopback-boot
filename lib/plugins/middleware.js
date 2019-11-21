// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const util = require('util');
const assert = require('assert');
const path = require('path');
const _ = require('lodash');
const cloneDeepWith = _.cloneDeepWith;
const cloneDeep = _.cloneDeep;
const debug = require('debug')('loopback:boot:middleware');
const PluginBase = require('../plugin-base');
const utils = require('../utils');
const g = require('../globalize');

const resolveAppScriptPath = utils.resolveAppScriptPath;

module.exports = function(options) {
  return new Middleware(options);
};

function Middleware(options) {
  PluginBase.call(this, options, 'middleware', 'middleware');
}

util.inherits(Middleware, PluginBase);

Middleware.prototype.getRootDir = function() {
  return this.options.middlewareRootDir || this.options.rootDir;
};

Middleware.prototype.merge = function(target, config, fileName) {
  let err, phase;
  for (phase in config) {
    if (phase in target) {
      err = this.mergePhaseConfig(target[phase], config[phase], phase);
    } else {
      err = g.f('The {{phase}} "%s" is not defined in the main config.', phase);
    }
    if (err)
      throw new Error(g.f('Cannot apply %s: ', fileName) + err);
  }
};

Middleware.prototype.mergePhaseConfig = function(target, config, phase) {
  let err, mw;
  for (mw in config) {
    if (mw in target) {
      const targetMiddleware = target[mw];
      const configMiddleware = config[mw];
      if (Array.isArray(targetMiddleware) && Array.isArray(configMiddleware)) {
        // Both are arrays, combine them
        target[mw] = this._mergeNamedItems(targetMiddleware, configMiddleware);
      } else if (Array.isArray(targetMiddleware)) {
        if (typeof configMiddleware === 'object' &&
          Object.keys(configMiddleware).length) {
          // Config side is an non-empty object
          target[mw] = this._mergeNamedItems(targetMiddleware,
            [configMiddleware]);
        }
      } else if (Array.isArray(configMiddleware)) {
        if (typeof targetMiddleware === 'object' &&
          Object.keys(targetMiddleware).length) {
          // Target side is an non-empty object
          target[mw] = this._mergeNamedItems([targetMiddleware],
            configMiddleware);
        } else {
          // Target side is empty
          target[mw] = configMiddleware;
        }
      } else {
        err = this._mergeObjects(targetMiddleware, configMiddleware);
      }
    } else {
      err = g.f('The {{middleware}} "%s" in {{phase}} "%s"' +
        'is not defined in the main config.', mw, phase);
    }
    if (err) return err;
  }
};

Middleware.prototype.buildInstructions = function(context, rootDir, config) {
  const phasesNames = Object.keys(config);
  const middlewareList = [];

  phasesNames.forEach(function(phase) {
    const phaseConfig = config[phase];
    Object.keys(phaseConfig).forEach(function(middleware) {
      let allConfigs = phaseConfig[middleware];
      if (!Array.isArray(allConfigs))
        allConfigs = [allConfigs];

      allConfigs.forEach(function(config) {
        const resolved = resolveMiddlewarePath(rootDir, middleware, config);
        // resolved.sourceFile will be false-y if an optional middleware
        // is not resolvable.
        // if a non-optional middleware is not resolvable, it will throw
        // at resolveAppPath() and not reach here
        if (!resolved.sourceFile) {
          return g.log('Middleware "%s" not found: %s',
            middleware,
            resolved.optional);
        }

        const middlewareConfig = cloneDeep(config);
        middlewareConfig.phase = phase;

        if (middlewareConfig.params) {
          middlewareConfig.params = resolveMiddlewareParams(
            rootDir, middlewareConfig.params,
          );
        }

        const item = {
          sourceFile: resolved.sourceFile,
          config: middlewareConfig,
        };
        if (resolved.fragment) {
          item.fragment = resolved.fragment;
        }
        middlewareList.push(item);
      });
    });
  });

  const flattenedPhaseNames = phasesNames
    .map(function getBaseName(name) {
      return name.replace(/:[^:]+$/, '');
    })
    .filter(function differsFromPreviousItem(value, ix, source) {
      // Skip duplicate entries. That happens when
      // `name:before` and `name:after` are both translated to `name`
      return ix === 0 || value !== source[ix - 1];
    });

  return {
    phases: flattenedPhaseNames,
    middleware: middlewareList,
  };
};

function resolveMiddlewarePath(rootDir, middleware, config) {
  const resolved = {
    optional: !!config.optional,
  };

  const segments = middleware.split('#');
  let pathName = segments[0];
  const fragment = segments[1];
  const middlewarePath = pathName;
  const opts = {
    strict: true,
    optional: !!config.optional,
  };

  if (fragment) {
    resolved.fragment = fragment;
  }

  if (pathName.indexOf('./') === 0 || pathName.indexOf('../') === 0) {
    // Relative path
    pathName = path.resolve(rootDir, pathName);
  }

  const resolveOpts = _.extend(opts, {
    // Workaround for strong-agent to allow probes to detect that
    // strong-express-middleware was loaded: exclude the path to the
    // module main file from the source file path.
    // For example, return
    //   node_modules/strong-express-metrics
    // instead of
    //   node_modules/strong-express-metrics/index.js
    fullResolve: false,
  });
  const sourceFile = resolveAppScriptPath(rootDir, middlewarePath, resolveOpts);

  if (!fragment) {
    resolved.sourceFile = sourceFile;
    return resolved;
  }

  // Try to require the module and check if <module>.<fragment> is a valid
  // function
  const m = require(sourceFile);
  if (typeof m[fragment] === 'function') {
    resolved.sourceFile = sourceFile;
    return resolved;
  }

  /*
   * module/server/middleware/fragment
   * module/middleware/fragment
   */
  const candidates = [
    pathName + '/server/middleware/' + fragment,
    pathName + '/middleware/' + fragment,
    // TODO: [rfeng] Should we support the following flavors?
    // pathName + '/lib/' + fragment,
    // pathName + '/' + fragment
  ];

  let err, ix;
  for (ix in candidates) {
    try {
      resolved.sourceFile = resolveAppScriptPath(rootDir, candidates[ix], opts);
      delete resolved.fragment;
      return resolved;
    } catch (e) {
      // Report the error for the first candidate when no candidate matches
      if (!err) err = e;
    }
  }
  throw err;
}

// Match values starting with `$!./` or `$!../`
const MIDDLEWARE_PATH_PARAM_REGEX = /^\$!(\.\/|\.\.\/)/;

function resolveMiddlewareParams(rootDir, params) {
  return cloneDeepWith(params, function resolvePathParam(value) {
    if (typeof value === 'string' && MIDDLEWARE_PATH_PARAM_REGEX.test(value)) {
      return path.resolve(rootDir, value.slice(2));
    } else {
      return undefined; // no change
    }
  });
}

Middleware.prototype.start = function(context) {
  const self = this;
  const app = context.app;
  const instructions = context.instructions.middleware;
  if (!instructions) {
    // the browserified client does not support middleware
    return;
  }

  // Phases can be empty
  const phases = instructions.phases || [];
  assert(Array.isArray(phases),
    'Middleware phases must be an array');

  const middleware = instructions.middleware;
  assert(Array.isArray(middleware),
    'Middleware must be an array');

  debug('Defining middleware phases %j', phases);
  app.defineMiddlewarePhases(phases);

  middleware.forEach(function(data) {
    debug('Configuring middleware %j%s', data.sourceFile,
      data.fragment ? ('#' + data.fragment) : '');
    let factory = require(data.sourceFile);
    if (data.fragment) {
      factory = factory[data.fragment].bind(factory);
    }
    assert(typeof factory === 'function',
      'Middleware factory must be a function');
    data.config = self.getUpdatedConfigObject(context, data.config,
      {useEnvVars: true});
    app.middlewareFromConfig(factory, data.config);
  });
};
