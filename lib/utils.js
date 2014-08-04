var cloneRegExp = require('regexp-clone');

/**
 * A faster Array.prototype.slice.call(arguments) alternative
 *
 */
exports.args = require('sliced');

exports.walk = function (path, obj, cb) {
    var steps = path.split('.');

    for (var i = 0; i < steps.length - 1; ++i) {
        obj = obj[steps[i]];
    }

    cb(obj, steps[steps.length - 1]);
};

exports.getValue = function (path, obj) {
    var ret;

    exports.walk(path, obj, function (o, k) {
        ret = o[k];
    });

    return ret;
};

exports.setValue = function (path, obj, value) {
    exports.walk(path, obj, function (o, k) {
        o[k] = value;
    });

    return value;
};

/**
 * Determines if `a` and `b` are deep equal.
 *
 * Modified from node/lib/assert.js
 *
 * @method deepEqual
 * @param a {mixed} a value to compare to `b`
 * @param b {mixed} a value to compare to `a`
 * @return {Boolean}
 */
exports.deepEqual = function (a, b) {
    if (a === b) return true;

    if (a instanceof Date && b instanceof Date)
        return a.getTime() === b.getTime();

    // if (a instanceof ObjectId && b instanceof ObjectId)
    //     return a.toString() === b.toString();

    if (a instanceof RegExp && b instanceof RegExp) {
        return a.source === b.source &&
                a.ignoreCase === b.ignoreCase &&
                a.multiline === b.multiline &&
                a.global === b.global;
    }

    if (typeof a !== 'object' && typeof b !== 'object')
        return a === b;

    if (a === null || b === null || a === undefined || b === undefined)
        return false;

    if (a.prototype !== b.prototype) return false;

    // Handle MongooseNumbers
    if (a instanceof Number && b instanceof Number) {
        return a.valueOf() === b.valueOf();
    }

    if (Buffer.isBuffer(a)) {
        return exports.buffer.areEqual(a, b);
    }

    // if (isMongooseObject(a)) a = a.toObject();
    // if (isMongooseObject(b)) b = b.toObject();

    var ka, kb, key, i;

    try {
        ka = Object.keys(a);
        kb = Object.keys(b);
    } catch (e) {//happens when one is a string literal and the other isn't
        return false;
    }

    // having the same number of owned properties (keys incorporates
    // hasOwnProperty)
    if (ka.length !== kb.length)
        return false;

    // the same set of keys (although not necessarily the same order),
    ka.sort();
    kb.sort();

    // cheap key test
    for (i = ka.length - 1; i >= 0; i--) {
        if (ka[i] !== kb[i])
            return false;
    }

    // equivalent values for every corresponding key, and
    // possibly expensive deep test
    for (i = ka.length - 1; i >= 0; i--) {
        key = ka[i];
        if (!exports.deepEqual(a[key], b[key])) return false;
    }

    return true;
};

/**
 * Shallow copies defaults into options.
 *
 * @method options
 * @param options {Object}
 * @param defaults {Object}
 * @return {Object} the merged object
 */
exports.options = function (options, defaults) {
    var keys = Object.keys(defaults),
        i = keys.length,
        k;

    options = options || {};

    while (i--) {
        k = keys[i];
        if (!(k in options)) {
            options[k] = defaults[k];
        }
    }

    return options;
};

/**
 * Determines if `arg` is an object.
 *
 * @method isObject
 * @param arg {mixed} The argument to check.
 * @return {Boolean}
 */
exports.isObject = function (arg) {
    return Object.prototype.toString.call(arg) === '[object Object]';
};

function cloneObject(obj, options) {
    var retainKeyOrder = options && options.retainKeyOrder,
        minimize = options && options.minimize,
        ret = {},
        hasKeys,
        keys,
        val,
        k,
        i;

    if (retainKeyOrder) {
        for (k in obj) {
            val = exports.clone(obj[k], options);

            if (!minimize || ('undefined' !== typeof val)) {
                hasKeys || (hasKeys = true);
                ret[k] = val;
            }
        }
    } else {
        // faster

        keys = Object.keys(obj);
        i = keys.length;

        while (i--) {
            k = keys[i];
            val = exports.clone(obj[k], options);

            if (!minimize || ('undefined' !== typeof val)) {
                if (!hasKeys) hasKeys = true;
                ret[k] = val;
            }
        }
    }

    return minimize ? hasKeys && ret : ret;
}

function cloneArray(arr, options) {
    var ret = [];
    for (var i = 0, l = arr.length; i < l; i++)
        ret.push(exports.clone(arr[i], options));

    return ret;
}

/**
 * Object clone.
 *
 * If options.minimize is true, creates a minimal data object. Empty objects and undefined
 * values will not be cloned. This makes the data payload sent to Couchbase as small as possible.
 *
 * Functions are never cloned.
 *
 * @param {Object} obj the object to clone
 * @param {Object} options
 * @return {Object} the cloned object
 * @api private
 */
exports.clone = function (obj, options) {
    if (obj === undefined || obj === null)
        return obj;

    if (Array.isArray(obj)) {
        return cloneArray(obj, options);
    }

    if (obj.constructor) {
        switch (obj.constructor.name) {
            case 'Object':
                return cloneObject(obj, options);
            case 'Date':
                return new obj.constructor(+obj);
            case 'RegExp':
                return cloneRegExp(obj);
            default:
                // ignore
                break;
        }
    }

    if (!obj.constructor && exports.isObject(obj)) {
        // object created with Object.create(null)
        return cloneObject(obj, options);
    }

    if (obj.valueOf) {
        return obj.valueOf();
    }
};
