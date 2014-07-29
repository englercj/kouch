var util = require('util'),
    events = require('events'),
    utils = require('./utils'),
    SchemaType = require('./schematype');

function Schema(obj, options) {
    if (!(this instanceof Schema))
        return new Schema(obj, options);

    events.EventEmitter.call(this);

    this._cache = {};

    /**
     * Schema as flat paths.
     *
     * ####Example:
     *     {
     *         '_id'       : SchemaType,
     *         'nested.key': SchemaType
     *     }
     *
     * @property paths
     * @private
     */
    this.paths = {};

    this.virtuals = {};
    this.nested = {};
    this.methods = {};
    this.statics = {};

    /**
     * Schema as a tree.
     *
     * ####Example:
     *     {
     *         '_id'     : ObjectId,
     *         'nested'  : {
     *             'key' : String
     *         }
     *     }
     *
     * @property tree
     * @private
     */
    this.tree = {};

    this.callQueue = [];

    this.options = this.defaultOptions(options);

    this.key = {
        path: null,
        prefix: false,
        suffix: false
    };

    // setup the schema key
    this._setupKey(obj);

    // build the schema paths
    if (obj) {
        this.add(obj);
    }
};

util.inherits(Schema, events.EventEmitter);

Schema.prototype._setupKey = function (obj) {
    var found = false;

    for (var k in obj) {
        if (obj[k] && obj[k].key) {
            found = true;

            this.key.path = k;
            this.key.prefix = obj[k].prefix;
            this.key.suffix = obj[k].suffix;

            if (obj[k].type !== String && obj[k].type !== Number) {
                throw new TypeError('Schema key must be a String or Number');
            }

            break;
        }
    }

    // if we didn't find a key, add a descriptor for default value
    if (!found) {
        this.key.path = '_id';
        this.add({
            _id: { type: String, auto: 'uuid', key: true }
        });
    }
};

/**
 * Returns default options for this schema, merged with `options`.
 *
 * @method defaultOptions
 * @private
 * @param {Object} options
 * @return {Object} The new options extended with defaults.
 */
Schema.prototype.defaultOptions = function (options) {
    return utils.options(options, {
    });
};

/**
 * Adds key path / schema type pairs to this schema.
 *
 * ####Example:
 *
 *     var ToySchema = new Schema;
 *     ToySchema.add({ name: String, color: Number, price: Number });
 *
 * @method add
 * @param obj {Object} The object descriptor.
 * @param prefix {String} The path prefix.
 */
Schema.prototype.add = function (obj, prefix) {
    prefix = prefix || '';

    var keys = Object.keys(obj);

    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];

        if (!obj[key]) {
            throw new TypeError('Invalid value for schema path `' + prefix + key + '`');
        }

        // if object, and is normal object, and has isn't a descriptor type
        if (utils.isObject(obj[key]) &&
            (!obj[key].constructor || obj[key].constructor.name === 'Object') &&
            (!obj[key].type || obj[key].type.type)
        ) {
            // nested object path, recurse
            if (Object.keys(obj[key]).length) {
                this.nested[prefix + key] = true;
                this.add(obj[key], prefix + key + '.');
            }
            // mixed type descriptor
            else {
                this.path(prefix + key, obj[key]);
            }
        }
        // mixed type descriptor
        else {
            this.path(prefix + key, obj[key]);
        }
    }
};

/**
 * Gets/sets schema paths.
 *
 * Sets a path (if arity 2)
 * Gets a path (if arity 1)
 *
 * ####Example
 *
 *     schema.path('name') // returns a SchemaType
 *     schema.path('name', Number) // changes the schemaType of `name` to Number
 *
 * @method path
 * @param path {String} The path to get/set.
 * @param constructor {Object} The ctor this path uses.
 */
Schema.prototype.path = function (path, obj) {
    if (!obj) {
        return this.paths[path];
    }

    // some path names conflict with document methods
    if (Schema.reserved[path]) {
        throw new Error('`' + path + '` may not be used as a schema pathname');
    }

    // update the tree
    var subpaths = path.split('.'),
        last = subpaths.pop(),
        branch = this.tree;

    subpaths.forEach(function(sub, i) {
        if (!branch[sub]) branch[sub] = {};

        if ('object' != typeof branch[sub]) {
            var msg = 'Cannot set nested path `' + path + '`. '
                    + 'Parent path `'
                    + subpaths.slice(0, i).concat([sub]).join('.')
                    + '` already set to type ' + branch[sub].name
                    + '.';
            throw new Error(msg);
        }

        branch = branch[sub];
    });

    branch[last] = utils.clone(obj);

    this.paths[path] = Schema.interpretAsType(path, obj);
    return this;
};

Schema.prototype.virtualpath = function (name) {
    return this.virtuals[name];
};

/**
 * Returns an Array of path strings that are required by this schema.
 *
 * @method requiredPaths
 * @return {Array} An array of the required paths
 */
Schema.prototype.requiredPaths = function requiredPaths () {
    if (this._cache.requiredpaths)
        return this._cache.requiredpaths;

    var paths = Object.keys(this.paths),
        i = paths.length,
        ret = [];

    while (i--) {
        var path = paths[i];
        if (this.paths[path].isRequired) ret.push(path);
    }

    return this._cache.requiredpaths = ret;
}

/**
 * Returns the pathType of `path` for this schema.
 *
 * Given a path, returns whether it is a real, virtual, nested, or ad-hoc/undefined path.
 *
 * @method pathType
 * @param path {String}
 * @return {String}
 */
Schema.prototype.pathType = function (path) {
    if (path in this.paths) return 'real';
    if (path in this.virtuals) return 'virtual';
    if (path in this.nested) return 'nested';

    return 'adhocOrUndefined';
};

/**
 * Adds a method call to the queue.
 *
 * @param name {String} name of the document method to call later
 * @param args {Array} arguments to pass to the method
 * @api private
 */
Schema.prototype.queue = function (name, args) {
    this.callQueue.push([name, args]);
    return this;
};

/**
 * Defines a pre hook for the document.
 *
 * ####Example
 *
 *     var toySchema = new Schema(..);
 *
 *     toySchema.pre('save', function (next) {
 *       if (!this.created) this.created = new Date;
 *       next();
 *     })
 *
 *     toySchema.pre('validate', function (next) {
 *       if (this.name != 'Woody') this.name = 'Woody';
 *       next();
 *     })
 *
 * @param {String} method
 * @param {Function} callback
 * @see hooks.js https://github.com/bnoguchi/hooks-js/tree/31ec571cef0332e21121ee7157e0cf9728572cc3
 * @api public
 */
Schema.prototype.pre = function () {
    return this.queue('pre', arguments);
};

/**
 * Defines a post hook for the document
 *
 * Post hooks fire `on` the event emitted from document instances of Models compiled from this schema.
 *
 *     var schema = new Schema(..);
 *     schema.post('save', function (doc) {
 *       console.log('this fired after a document was saved');
 *     });
 *
 *     var Model = kouch.model('Model', schema);
 *
 *     var m = new Model(..);
 *     m.save(function (err) {
 *       console.log('this fires after the `post` hook');
 *     });
 *
 * @param {String} method name of the method to hook
 * @param {Function} fn callback
 * @see hooks.js https://github.com/bnoguchi/hooks-js/tree/31ec571cef0332e21121ee7157e0cf9728572cc3
 * @api public
 */
Schema.prototype.post = function (method, fn) {
    return this.queue('on', arguments);
};

/**
 * Adds an instance method to documents constructed from Models compiled from this schema.
 *
 * ####Example
 *
 *     var schema = kittySchema = new Schema(..);
 *
 *     schema.method('meow', function () {
 *       console.log('meeeeeoooooooooooow');
 *     })
 *
 *     var Kitty = kouch.model('Kitty', schema);
 *
 *     var fizz = new Kitty();
 *     fizz.meow(); // meeeeeooooooooooooow
 *
 * If a hash of name/fn pairs is passed as the only argument, each name/fn pair will be added as methods.
 *
 *     schema.method({
 *         purr: function () {},
 *         scratch: function () {}
 *     });
 *
 *     // later
 *     fizz.purr();
 *     fizz.scratch();
 *
 * @method method
 * @param name {String|Object}
 * @param [fn] {Function}
 */
Schema.prototype.method = function (name, fn) {
    if (typeof name !== 'string') {
        for (var i in name)
            this.methods[i] = name[i];
    } else {
        this.methods[name] = fn;
    }

    return this;
};

/**
 * Adds static 'class' methods to Models compiled from this schema.
 *
 * ####Example
 *
 *     var schema = new Schema(..);
 *     schema.static('findByName', function (name, callback) {
 *       return this.find({ name: name }, callback);
 *     });
 *
 *     var Drink = kouch.model('Drink', schema);
 *     Drink.findByName('sanpellegrino', function (err, drinks) {
 *       //
 *     });
 *
 * If a hash of name/fn pairs is passed as the only argument, each name/fn pair will be added as statics.
 *
 * @method static
 * @param name {String|Object}
 * @param [fn] {Function}
 */
Schema.prototype.static = function(name, fn) {
    if ('string' != typeof name) {
        for (var i in name)
            this.statics[i] = name[i];
    } else {
        this.statics[name] = fn;
    }

    return this;
};

/**
 * Sets/gets a schema option.
 *
 * @method set
 * @param key, {String} option name
 * @param [value] {Object} if not passed, the current option value is returned
 */
Schema.prototype.set = function (key, value, _tags) {
    if (1 === arguments.length) {
        return this.options[key];
    }

    this.options[key] = value;

    return this;
}

Schema.prototype.get = Schema.prototype.set;

/**
 * Creates a virtual type with the given name.
 *
 * @param name {String}
 * @param [options] {Object}
 * @return {VirtualType}
 */
Schema.prototype.virtual = function (name, options) {
    var parts = name.split('.');

    return this.virtuals[name] = parts.reduce(function (mem, part, i) {
        mem[part] || (mem[part] = (i === parts.length-1)
                            ? new SchemaType(name, options, true)
                            : {});
        return mem[part];
    }, this.tree);
};

/**
 * Reserved document keys.
 *
 * Keys in this object are names that are rejected in schema declarations b/c they conflict with kouch functionality.
 * Using these key name will throw an error.
 *
 * _NOTE:_ Use of these terms as method names is permitted, but play at your own risk, as they may be existing
 * document methods you are stomping on.
 *
 *      var schema = new Schema(..);
 *      schema.methods.init = function () {} // potentially breaking
 *
 * @property reserved
 * @static
 */
Schema.reserved = {
    on:         1,
    db:         1,
    set:        1,
    get:        1,
    init:       1,
    isNew:      1,
    errors:     1,
    schema:     1,
    options:    1,
    modelName:  1,
    collection: 1,
    toObject:   1,
    emit:       1, // EventEmitter
    _events:    1, // EventEmitter
    _pres:      1
};

/**
 * Converts type arguments into Kouch Types.
 *
 * @param {String} path
 * @param {Object} obj constructor
 * @api private
 */

Schema.interpretAsType = function (path, obj) {
    if (obj.constructor && obj.constructor.name !== 'Object')
        obj = { type: obj };

    return new SchemaType(path, obj);
};

module.exports = Schema;
