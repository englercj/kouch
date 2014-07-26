var util = require('util'),
    uuid = require('uuid'),
    hooks = require('hooks'),
    events = require('events'),
    Schema = require('./schema'),
    utils = require('./utils');

function Model(doc) {
    if (!(this instanceof Model))
        return new Model(doc);

    events.EventEmitter.call(this);

    this._doc = buildDefaultDocument.call(this);

    this._cache = {};

    if (doc) {
        this.set(doc, undefined, true);
    }

    this._registerHooks();
}

util.inherits(Model, events.EventEmitter);

var noop = function () {};

/**
 * Set up middleware support
 */
for (var k in hooks) {
    Model.prototype[k] = Model[k] = hooks[k];
}

/**
 * Load a model from the associated bucket
 *
 * @method load
 * @static
 * @param key {String} The key for the document.
 * @param [options] {Object} The options for the get operation.
 * @param [callback] {Function} The function to call when the get returns.
 */
Model.load = function (key, options, cb) {
    if (Array.isArray(key)) {
        return Model.loadMulti.apply(this, arguments);
    }

    if (typeof options === 'function') {
        cb = options;
        options = null;
    }

    cb = cb || noop;

    var self = this;
    this.bucket.get(this.key(key), options, function (err, result) {
        if (err) return cb(err);

        var SubModel = self.model(self.modelName),
            mdl = new SubModel(result.value);

        mdl._cache.cas = result.cas;

        cb(null, mdl);
    });

    return this;
};

/**
 * Load multiple models from the associated bucket
 *
 * @method loadMulti
 * @static
 * @param keys {Array<String>} The keys for the documents.
 * @param [options] {Object} The options for the get operation.
 * @param [callback] {Function} The function to call when the get returns.
 */
Model.loadMulti = function (keys, options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = null;
    }

    cb = cb || noop;

    var self = this;
    this.bucket.getMulti(keys.map(this.key.bind(this)), options, function (err, results) {
        if (err) return cb(err);

        var SubModel = self.model(self.modelName),
            models = [],
            mdl;

        for (var k in results) {
            mdl = new SubModel(results[k].value);
            mdl._cache.cas = results[k].cas;

            models.push(mdl);
        }

        cb(null, models);
    });

    return this;
};

/**
 * Remove a model from the associated bucket
 *
 * @method remove
 * @static
 * @param key {String} The key for the document.
 * @param [options] {Object} The options for the remove operation.
 * @param [callback] {Function} The function to call when the remove returns.
 */
Model.remove = function (key, options, cb) {
    if (Array.isArray(key)) {
        return Model.removeMulti.apply(this, arguments);
    }

    if (typeof options === 'function') {
        cb = options;
        options = null;
    }

    cb = cb || noop;

    var self = this;
    this.bucket.remove(this.key(key), options, function (err, result) {
        if (err) return cb(err);

        cb(null, result);
    });

    return this;
};

/**
 * Remove multiple models from the associated bucket
 *
 * @method removeMulti
 * @static
 * @param keys {Array<String>} The keys for the documents.
 * @param [options] {Object} The options for the remove operation.
 * @param [callback] {Function} The function to call when the remove returns.
 */
Model.removeMulti = function (keys, options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = null;
    }

    cb = cb || noop;

    var self = this;
    this.bucket.removeMulti(keys.map(this.key.bind(this)), options, function (err, results) {
        if (err) return cb(err);

        cb(null, results);
    });

    return this;
};

/**
 * Create one or many documents
 *
 * @method create
 * @static
 * @param doc {Object|Array<Object>} The document(s) to create.
 * @param [callback] {Function} The function to call upon the completion of the operation.
 */
Model.create = function (doc, cb) {
    var self = this;

    if (!Array.isArray(doc)) {
        doc = [doc];
    }

    var count = doc.length,
        docs = [],
        SubModel = this.model(this.modelName);

    doc.forEach(function (o, i) {
        var mdl = o;

        if (!(mdl instanceof self)) {
            mdl = new SubModel(o);
        }

        docs.push(mdl);

        mdl.save(function (err) {
            if (err) return cb(err);
            --count || cb(null, docs.length === 1 ? docs[0] : docs);
        });
    });
};

// Model.upsert = function (key, value, options, cb) {
// };

// Model.upsertMulti = function (kvPairs, options, cb) {
// };

// Model.replace = function (key, value, options, cb) {
// };

// Model.replaceMulti = function (kvPairs, options, cb) {
// };

// Model.append = function (key, str, options, cb) {
// };

// Model.appendMulti = function (kvPairs, options, cb) {
// };

// Model.prepend = function (key, str, options, cb) {
// };

// Model.prependMulti = function (kvPairs, options, cb) {
// };

// Model.touch = function (key, options, cb) {
// };

// Model.touchMulti = function (kvPairs, options, cb) {
// };

// Model.counter = function (key, options, cb) {
// };

// Model.counterMulti = function (kvPairs, options, cb) {
// };

// Model.query = function (query, cb) {
// };

// Model.lock = function (key, options, cb) {
// };

// Model.lockMulti = function (keys, options, cb) {
// };

// Model.unlock = function (key, options, cb) {
// };

// Model.unlockMulti = function (keys, options, cb) {
// };

Model.key = Model.prototype.key = function (key) {
    var prefix = this.schema.get('key.prefix') || (this.modelName + ':');

    return prefix + key;
};

/**
 * Save this model to the associated bucket
 *
 * @method save
 * @param [options] {Object} The options for the save operation.
 * @param [callback] {Function} The function to call upon the completion of the operation.
 */
Model.prototype.save = function (options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = null;
    }

    options = options || {};
    cb = cb || noop;

    if (!this._id) {
        this._id = uuid.v4();
    }

    options.cas = this._cache.cas;

    var self = this;
    this.bucket.upsert(this.key(this._id), this.toObject(), options, function (err, result) {
        if (err) return cb(err);

        self._cache.cas = result.cas;

        cb(null, self);
    });

    return this;
};

/**
 * Remove this model from the associated bucket
 *
 * @method remove
 * @param [options] {Object} The options for the remove operation.
 * @param [callback] {Function} The function to call upon the completion of the operation.
 */
Model.prototype.remove = function (options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = null;
    }

    options = options || {};
    cb = cb || noop;

    if (!this._id) {
        return setImmediate(function () {
            cb(new Error('This document has no id, set one before calling remove or use auto _ids'));
        });
    }

    options.cas = this._cache.cas;

    var self = this;
    this.bucket.remove(this.key(this._id), this.toObject(), options, function (err, result) {
        if (err) return cb(err);

        self._cache.cas = result.cas;

        cb();
    });

    return this;
};

Model.prototype.validate = function (cb) {
    var self = this,
        paths = Object.keys(this.schema.paths),
        error = null;

    if (paths.length === 0) {
        complete();
        return this;
    }

    var validating = {},
        total = 0;

    paths.forEach(validatePath);


    function validatePath(path) {
        if (validating[path]) return;

        validating[path] = true;
        total++;

        setImmediate(function () {
            var p = self.schema.path(path);
            if (!p) return --total || complete();

            var val = self.getValue(path);
            p.applyValidators(val, function (err) {
                if (err) {
                    error = err;
                }

                --total || complete();
            }, self);
        });
    }

    function complete() {
        self.emit('validate', self);
        if (error) {
            debugger;
        }
        cb(error);
    }

    return this;
};

/**
 * Gets a raw value from a path (no getters)
 *
 * @param {String} path
 * @api private
 */
Model.prototype.getValue = function (path) {
  return utils.getValue(path, this._doc);
}

/**
 * Sets a raw value for a path (no casting, setters, transformations)
 *
 * @param {String} path
 * @param {Object} value
 * @api private
 */
Model.prototype.setValue = function (path, val) {
  utils.setValue(path, this._doc, val);
  return this;
}

Model.prototype.get = function (path, type) {
    var schema = this.schema.path(path) || this.schema.virtualpath(path),
        pieces = path.split('.'),
        obj = this._doc;

    for (var i = 0, il = pieces.length; i < il; ++i) {
        obj = obj === undefined || obj === null ? undefined : obj[pieces[i]];
    }

    if (schema) {
        obj = schema.applyGetters(obj, this);
    }

    return obj;
}

Model.prototype.set = function (path, val, type, options) {
    var constructing = (type === true);

    // when an object is passed: `new Model({ key: val })`
    if (typeof path !== 'string') {
        if (path === null || path === undefined) {
            var _ = path;
            path = val;
            val = _;
        } else {
            var prefix = val ? val + '.' : '';

            if (path instanceof Model) path = path._doc;

            var keys = Object.keys(path),
                i = keys.length,
                pathtype,
                key;

            while (i--) {
                key = keys[i];
                pathtype = this.schema.pathType(prefix + key);

                if (path[key] != null
                    && utils.isObject(path[key])
                    && (!path[key].constructor || path[key].constructor.name === 'Object')
                    && pathtype !== 'virtual'
                    && !(this.schema.paths[key] && this.schema.paths[key].options.ref)
                ) {
                    this.set(path[key], prefix + key, constructing);
                } else if (pathtype === 'real' || pathtype === 'virtual') {
                    this.set(prefix + key, path[key], constructing);
                } else if (path[key] !== undefined) {
                    this.set(prefix + key, path[key], constructing);
                }
            }

            return this;
        }
    }

    var pathType = this.schema.pathType(path);
    if (pathType === 'nested' && val && utils.isObject(val) && (!val.constructor || val.constructor.name === 'Object')) {
        this.set(val, path, constructing);
        return this;
    }

    var parts = path.split('.'),
        schema;

    if (pathType === 'virtual') {
        schema = this.schema.virtualpath(path);
        schema.applySetters(val, this);
        return this;
    } else {
        schema = this.schema.path(path);
    }

    var priorVal = constructing ? undefined : this.get(path);

    if (schema && val !== undefined) {
        val = schema.applySetters(val, this, false, priorVal);
    }

    if (schema) {
        this._set(path, parts, schema, val, priorVal);
    }

    return this;
};

/**
 * @method toObject
 * @param [options] {Object}
 * @param [options.minimize=true] {Boolean}
 * @param [options.virtuals] {Boolean}
 * @param [options.getters] {Boolean}
 * @param [options.transform] {Function}
 * @return {Object}
 */
Model.prototype.toObject = function (options) {
    options = options || {};
    options.minimize = options.minimize !== undefined ? options.minimize : true;

    var ret = utils.clone(this._doc, options);

    if (options.virtuals || (options.getters && options.virtuals !== false)) {
        applyGetters(this, ret, 'virtuals', options);
    }

    if (options.getters) {
        applyGetters(this, ret, 'paths', options);

        // applyGetters for paths will add nested empty objects;
        // if minimize is set, we need to remove them.
        if (options.minimize) {
            ret = minimize(ret) || {};
        }
    }

    if (typeof options.transform === 'function') {
        var xformed = options.transform(this, ret, options);

        if (typeof xformed !== 'undefined') {
            ret = xformed;
        }
    }

    return ret;
};

Model.prototype.toJSON = function (options) {
    options = options || {};
    options.json = true;

    return this.toObject(options);
};

Model.prototype.model = function model (name) {
    return this.base.model(name, this.bucketName);
};

Model.prototype._set = function (path, parts, schema, val, priorVal) {
    var obj = this._doc,
        i = 0,
        l = parts.length;

    for (; i < l; ++i) {
        var next = i + 1,
            last = (next === l);

        if (last) {
            obj[parts[i]] = val;
        } else {
            if (obj[parts[i]] && obj[parts[i]].constructor.name === 'Object') {
                obj = obj[parts[i]];
            } else if (obj[parts[i]] && Array.isArray(obj[parts[i]])) {
                obj = obj[parts[i]];
            } else {
                obj = obj[parts[i]] = {};
            }
        }
    }
};

Model.prototype._processQueue = function () {
    var q = this.schema && this.schema.callQueue;
    if (q) {
        for (var i = 0, il = q.length; i < il; ++i) {
            this[q[i][0]].apply(this, q[i][1]);
        }
    }

    return this;
};

Model.prototype._registerHooks = function () {
    this.pre('save', function validation(next) {
        return this.validate(next);
    });

    this._processQueue();
};

Model.compile = function (name, bucketName, bucket, schema, base) {
    // create a class specifically for this schema/bucket
    function model(doc) {
        if (!(this instanceof model))
            return new model(doc);

        Model.call(this, doc);
    }

    model.constructor = model;
    model.constructor.name = name;

    model.__proto__ = Model;
    model.prototype.__proto__ = Model.prototype;
    model.model = Model.prototype.model;
    model.base = model.prototype.base = base;
    model.bucketName = model.prototype.bucketName = bucketName;
    model.modelName = model.prototype.modelName = name;
    model.schema = model.prototype.schema = schema;
    model.bucket = model.prototype.bucket = bucket;

    initSchema(schema, schema.tree, model.prototype);

    // apply default statics
    var k = null;
    for (k in Model.statics) {
        if (model[k]) throw new Error('Unable to add default static method "' + k + '", already exists.');
        else model[k] = Model.statics[k];
    }

    // apply the methods
    k = null;
    for (k in schema.methods) {
        if (model.prototype[k]) throw new Error('Unable to add method "' + k + '", already exists on prototype.');
        else model.prototype[k] = schema.methods[k];
    }

    // apply the statics
    k = null;
    for (k in schema.statics) {
        if (model[k]) throw new Error('Unable to add static "' + k + '", already exists.');
        else model[k] = schema.statics[k];
    }

    return model;
};

function initSchema(schema, tree, proto, prefix) {
    var keys = Object.keys(tree),
        i = keys.length,
        limb,
        key;

    while (i--) {
        key = keys[i];
        limb = tree[key];

        define(
            schema,
            key,
            (
                (limb.constructor.name === 'Object' && Object.keys(limb).length)
                && (!limb.type || limb.type.type)
                    ? limb
                    : null
            ),
            proto,
            prefix,
            keys
        );
    }
};

function define(schema, prop, subprops, prototype, prefix, keys) {
    var prefix = prefix || '',
        path = (prefix ? prefix + '.' : '') + prop;

    if (subprops) {
        Object.defineProperty(prototype, prop, {
            enumerable: true,
            get: function () {
                if (!this._cache.getters)
                    this._cache.getters = {};

                if (!this._cache.getters[path]) {
                    var nested = Object.create(this),
                        i = 0,
                        len = keys.length;

                    if (!prefix) nested._cache.scope = this;

                    for (; i < len; ++i) {
                        //over-write parents getter without triggering it
                        Object.defineProperty(nested, keys[i], {
                            enumerable: false,  // It doesn't show up.
                            writable: true,     // We can set it later.
                            configurable: true, // We can Object.defineProperty again.
                            value: undefined    // It shadows its parent.
                        });
                    }

                    nested.toObject = function () {
                        return this.get(path);
                    };

                    initSchema(schema, subprops, nested, path);
                    this._cache.getters[path] = nested;
                }

                return this._cache.getters[path];
            },
            set: function (v) {
                if (v instanceof Model) v = v.toObject();
                return (this._cache.scope || this).set(path, v);
            }
        })
    } else {
        var type = schema.path(path);
        if (type && type.autoValue) {
            Object.defineProperty(prototype, prop, {
                enumerable: true,
                get: function () {
                    var scope = this._cache.scope || this;

                    if (!scope._cache.auto)
                        scope._cache.auto = {};

                    if (!scope._cache.auto[path]) {
                        scope.set(path, uuid.v4());
                        scope._cache.auto[path] = true;
                    }

                    return scope.get(path);
                },
                set: function (v) {
                    return this.set.call(this._cache.scope || this, path, v);
                }
            });
        } else {
            Object.defineProperty(prototype, prop, {
                enumerable: true,
                get: function () {
                    return this.get.call(this._cache.scope || this, path);
                },
                set: function (v) {
                    return this.set.call(this._cache.scope || this, path, v);
                }
            });
        }
    }
}

// function decorate(self, doc) {
//     Object.keys(self.schema.paths).forEach(function (path) {
//         addPath(path, self, doc, false);
//     });

//     Object.keys(self.schema.virtuals).forEach(function (path) {
//         addPath(path, self, doc, true);
//     });
// }

// function addPath(path, self, doc, virtual) {
//     utils.walk(path, self, function (obj, key) {
//         Object.defineProperty(obj, key, {
//             get: function () {
//                 var val = virtual ? null : utils.getValue(path, doc);
//                 return self.schema.path(path).applyGetters(val, this);
//             },
//             set: function (v) {
//                 return self.schema.path(path).applySetters(v, this);
//             }
//         });
//     });
// }

function buildDefaultDocument() {
    var doc = {},
        paths = Object.keys(this.schema.paths),
        plen = paths.length;

    for (var ii = 0; ii < plen; ++ii) {
        var p = paths[ii],
            type = this.schema.paths[p],
            path = p.split('.'),
            len = path.length,
            last = len - 1,
            curPath = '',
            doc_ = doc;

        for (var i = 0; i < len; ++i) {
            var piece = path[i],
                def;

            if (i === last) {
                def = type.getDefault(this);
                if (def !== undefined) {
                    doc_[piece] = def;
                }
            } else {
                doc_ = doc_[piece] || (doc_[piece] = {});
            }
        }
    }

    return doc;
}


/**
 * Minimizes an object, removing undefined values and empty objects
 *
 * @param {Object} object to minimize
 * @return {Object}
 */
function minimize (obj) {
    var keys = Object.keys(obj),
        i = keys.length,
        hasKeys,
        key,
        val;

    while (i--) {
        key = keys[i];
        val = obj[key];

        if (utils.isObject(val)) {
            obj[key] = minimize(val);
        }

        if (obj[key] === undefined) {
            delete obj[key];
            continue;
        }

        hasKeys = true;
    }

    return hasKeys ? obj : undefined;
}

/**
 * Applies virtuals properties to `json`.
 *
 * @param {Document} self
 * @param {Object} json
 * @param {String} type either `virtuals` or `paths`
 * @return {Object} `json`
 */
function applyGetters (self, json, type, options) {
    var schema = self.schema,
        paths = Object.keys(schema[type]),
        i = paths.length,
        path;

    while (i--) {
        path = paths[i];

        var parts = path.split('.'),
            plen = parts.length,
            last = plen - 1,
            branch = json,
            part;

        for (var ii = 0; ii < plen; ++ii) {
            part = parts[ii];
            if (ii === last) {
                branch[part] = utils.clone(self.get(path), options);
            } else {
                branch = branch[part] || (branch[part] = {});
            }
        }
    }

    return json;
}

module.exports = Model;
