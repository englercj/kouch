var Buffer = require('buffer').Buffer,
    utils = require('./utils');

function SchemaType(path, obj, virtual) {
    obj = obj || {};

    this.path = path;

    this.type = obj.type;

    this.enumValues = [];
    this.validators = [];
    this.getters = [];
    this.setters = [];

    this.virtual = !!virtual;
    this.autoType = null;
    this.isRequired = false;

    // create these stubs in the ctor, so that method calls don't create
    // new hidden classes when V8 tries to optimize.
    this.minValidator = null;
    this.maxValidator = null;
    this.enumValidator = null;
    this.requiredValidator = null;

    // run helpers based on the object shortcuts
    var keys = Object.keys(obj),
        key = null;

    for (var i = 0; i < keys.length; ++i) {
        key = keys[i];
        if (key === 'type') continue;

        if (typeof this[key] === 'function') {
            this[key](obj[key]);
        }
    }
}

SchemaType.prototype.cast = function (value) {
    if (this.type === String) {
        return value + '';
    }
    else {
        return new (this.type)(value);
    }
};

SchemaType.prototype.auto = function (autoType) {
    this.autoType = autoType;
};

SchemaType.prototype.get = function (fn) {
    if (typeof fn !== 'function')
        throw new TypeError('A getter must be a function.');

    this.getters.push(fn);
    return this;
};

SchemaType.prototype.set = function (fn) {
    if (typeof fn !== 'function')
        throw new TypeError('A setter must be a function.');

    this.setters.push(fn);
    return this;
};

SchemaType.prototype.default = function (val) {
    if (arguments.length === 1) {
        this.defaultValue = typeof val === 'function' ? val : this.cast(val);
    } else if (arguments.length > 1) {
        this.defaultValue = utils.args(arguments);
    }

    return this;
};

SchemaType.prototype.validate = function (obj, message) {
    if (typeof obj === 'function' || (obj && obj.constructor.name === 'RegExp')) {
        if (!message) message = 'Invalid value for schema';

        this.validators.push([obj, message, 'user defined']);
        return this;
    }

    // you can also pass multiple validator objects
    var i = arguments.length,
        arg;

    while (i--) {
        arg = arguments[i];
        if (!(arg && arg.constructor.name === 'Object')) {
            throw new Error('Invalid validator. Got (' + typeof arg + '): ' + arg);
        }

        this.validate(arg.validator, arg.msg || arg.message);
    }

    return this;
};

SchemaType.prototype.getDefault = function (scope) {
    var ret = typeof this.defaultValue === 'function' ?
                this.defaultValue.call(scope) : this.defaultValue;

    if (ret !== null && ret !== undefined) {
        return this.cast(ret);
    } else {
        return ret;
    }
};

////////////////////////////////////////////////
// Setter shortcuts
////////////////////////////////////////////////
SchemaType.prototype.lowercase = function () {
    return this.set(function (v) {
        if (v && v.toLowerCase) return v.toLowerCase();
        return v;
    });
};

SchemaType.prototype.uppercase = function () {
    return this.set(function (v) {
        if (v && v.toUpperCase) return v.toUpperCase();
        return v;
    });
};

SchemaType.prototype.trim = function () {
    return this.set(function (v) {
        if (v && v.trim) return v.trim();
        return v;
    });
};

////////////////////////////////////////////////
// Validator shortcuts
////////////////////////////////////////////////
SchemaType.prototype.required = function (required, message) {
    if (required === false) {
        this.validators = this.validators.filter(function (v) {
            return v[0] !== this.requiredValidator;
        }, this);

        this.isRequired = false;
        return this;
    }

    var self = this;
    this.isRequired = true;

    this.requiredValidator = function (value) {
        switch(self.type) {
            case Boolean:
                return value === true || value === false;
            case Date:
                return value instanceof Date;
            case Number:
                return typeof value === 'number' || value instanceof Number;
            case String:
                return (value instanceof String || typeof value === 'string') && value.length;
            case Array:
                return !!(value && value.length);
            case Buffer:
                return !!(value && value.length);
            default:
                return (value !== undefined) && (value !== null);
        }
    };

    if (typeof required === 'string') {
        message = required;
        required = undefined;
    }

    var msg = message || 'is required';
    this.validators.push([this.requiredValidator, msg, 'required']);

    return this;
};

SchemaType.prototype.min = function (val, message) {
    if (this.minValidator) {
        this.validators = this.validators.filter(function (v) {
            return v[0] !== this.minValidator;
        }, this);
        this.minValidator = false;
    }

    if (val != null) { //jshint ignore:line
        var msg = message || 'must be at or above minimum of: ' + val;

        this.minValidator = function (v) {
            return v === null || v >= val;
        };
        this.validators.push([this.minValidator, msg, 'min']);
    }

    return this;
};

SchemaType.prototype.max = function (val, message) {
    if (this.maxValidator) {
        this.validators = this.validators.filter(function (v) {
            return v[0] !== this.maxValidator;
        }, this);
        this.maxValidator = false;
    }

    if (val != null) { //jshint ignore:line
        var msg = message || 'must be at or below maximum of: ' + val;

        this.maxValidator = function (v) {
            return v === null || v <= val;
        };
        this.validators.push([this.maxValidator, msg, 'max']);
    }

    return this;
};

SchemaType.prototype.match = function (rgx, message) {
    var msg = message || 'must match: ' + rgx;

    function matchValidator (v) {
        return v !== null && v !== undefined && v !== '' ? rgx.test(v) : true;
    }

    this.validators.push([matchValidator, msg, 'regexp']);
    return this;
};

SchemaType.prototype.enum = function () {
    if (this.enumValidator) {
        this.validators = this.validators.filter(function (v) {
            return v[0] !== this.enumValidator;
        }, this);
        this.enumValidator = false;
    }

    if (arguments[0] === undefined || arguments[0] === false) {
        return this;
    }

    var values, errorMessage;

    if (utils.isObject(arguments[0])) {
        values = arguments[0].values;
        errorMessage = arguments[0].message;
    }
    else if (Array.isArray(arguments[0])) {
        values = arguments[0];
    }
    else {
        values = utils.args(arguments);
    }

    if (!errorMessage) {
        errorMessage = 'must be within defined enum: [' + values + ']';
    }

    for (var i = 0; i < values.length; ++i) {
        if (values[i] !== undefined) {
            this.enumValues.push(this.cast(values[i]));
        }
    }

    var vals = this.enumValues;
    this.enumValidator = function (v) {
        return v === undefined || vals.indexOf(v) !== -1;
    };
    this.validators.push([this.enumValidator, errorMessage, 'enum']);

    return this;
};

////////////////////////////////////////////////
// Apply functions
////////////////////////////////////////////////
SchemaType.prototype.applyGetters = function (value, scope) {
    var v = value;
    for (var l = this.getters.length - 1; l >= 0; --l) {
        v = this.getters[l].call(scope, v, this);
    }

    return v;
};

SchemaType.prototype.applySetters = function (value, scope) {
    var v = value;
    for (var l = this.setters.length - 1; l >= 0; --l) {
        v = this.setters[l].call(scope, v, this);
    }

    return v;
};

SchemaType.prototype.applyValidators = function (value, fn, scope) {
    var errorMessage = '',
        path = this.path,
        count = this.validators.length;

    if (!count) return fn();

    function _validate(ok, message, type, val) {
        if (!ok && ok !== undefined) {
            errorMessage += 'Value at path "' + path + '" ' + message + ', got: ' + val + '\n';
        }

        if (--count === 0) {
            fn(errorMessage ? new Error(errorMessage) : null);
        }
    }

    this.validators.forEach(function (v) {
        var validator = v[0],
            message = v[1],
            type = v[2];

        if (validator instanceof RegExp) {
            _validate(validator.test(value), message, type, value);
        }
        else if (typeof validator === 'function') {
            if (validator.length === 2) {
                validator.call(scope, value, function (ok) {
                    _validate(ok, message, type, value);
                });
            }
            else {
                _validate(validator.call(scope, value), message, type, value);
            }
        }
    });
};

module.exports = SchemaType;
