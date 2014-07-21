var Document = require('./document'),
    Schema = require('./schema'),
    util = require('util'),
    utils = require('./utils');

function Model(doc, key) {
    this._doc = buildDefaultDocument.call(this);

    this._cache = {};

    if (doc) {
        this.set(doc, undefined, true);
    }

    // add document getters/setters
    // decorate(this, doc);
}

Model.prototype.save = function save(fn) {

};

Model.prototype.load = function load(key, fn) {

};

Model.prototype.remove = function remove(fn) {

};

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

Model.prototype.set = function set(path, val, type, options) {
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

    this._set(path, parts, schema, val, priorVal);

    return this;
};

Model.prototype._set = function(path, parts, schema, val, priorVal) {
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

Model.compile = function (name, bucket, schema, base) {
    // create a class specifically for this schema/bucket
    function model(doc) {
        if (!(this instanceof model))
            return new model(doc);

        this.schema = schema;
        this.bucket = bucket;
        this.base = base;

        initSchema(this.schema, this.schema.tree, this);

        Model.call(this, doc);
    }

    model.constructor = model;
    model.constructor.name = name;

    util.inherits(model, Model);

    // apply the methods
    for (var k in schema.methods) {
        if (model.prototype[k]) throw new Error('Unable to add method "' + k + '", already exists on prototype.');
        else model.prototype[k] = schema.methods[k];
    }

    // apply the statics
    for (var k2 in schema.statics) {
        if (model.prototype[k2]) throw new Error('Unable to add static "' + k2 + '", already exists.');
        else model[k2] = schema.statics[k2];
    }

    return model;
};

Model.toJSON = function () {
    return this._doc;
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

module.exports = Model;
