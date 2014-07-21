function SchemaType(path, obj, virtual) {
    obj = obj || {};

    this.path = path;

    this.type = obj.type;

    this.enumValues = [];
    this.validators = [];
    this.getters = [];
    this.setters = [];

    this.virtual = !!virtual;

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

    // create these stubs in the ctor, so that method calls don't create
    // new hidden classes when V8 tries to optimize.
    this.minValidator = null;
    this.maxValidator = null;
    this.enumValidator = null;
};

SchemaType.prototype.cast = function cast(value) {
    return new (this.type)(value);
};

SchemaType.prototype.get = function addGetter(fn) {
    if (typeof fn !== 'function')
        throw new TypeError('A getter must be a function.');

    this.getters.push(fn);
    return this;
};

SchemaType.prototype.set = function addSetter(fn) {
    if (typeof fn !== 'function')
        throw new TypeError('A setter must be a function.');

    this.setters.push(fn);
    return this;
};

SchemaType.prototype.default = function setDefault(val) {
    if (arguments.length === 1) {
        this.defaultValue = typeof val === 'function' ? val : this.cast(val);
    } else if (arguments.length > 1) {
        this.defaultValue = utils.args(arguments);
    }

    return this;
};

SchemaType.prototype.validate = function validate(obj, message) {
    if (typeof obj === 'function' || (obj && obj.constructor.name === 'RegExp')) {
        if (!message) message = 'Invalid value for schema';

        this.validators.push([obj, message, 'user defined']);
        return this;
    }

    // you can also pass multiple validator objects
    var i = arguments.length,
        arg;

    while (i--) {
        args = arguments[i];
        if (!(arg && arg.constructor.name === 'Object')) {
            throw new Error('Invalid validator. Got (' + typeof arg + ') ' + arg);
        }

        this.validate(arg.validator, arg.msg || arg.message);
    }

    return this;
};

SchemaType.prototype.getDefault = function (scope) {
    var ret = typeof this.defaultValue === 'function'
                    ? this.defaultValue.call(scope)
                    : this.defaultValue;

    if (ret != null) {
        return this.cast(ret);
    } else {
        return ret;
    }
};

////////////////////////////////////////////////
// Setter shortcuts
////////////////////////////////////////////////
SchemaType.prototype.lowercase = function () {
    return this.set(function (v, self) {
        if (v && v.toLowerCase) return v.toLowerCase();
        return v;
    });
};

SchemaType.prototype.uppercase = function () {
    return this.set(function (v, self) {
        if (v && v.toUpperCase) return v.toUpperCase();
        return v;
    });
};

SchemaType.prototype.trim = function () {
    return this.set(function (v, self) {
        if (v && v.trim) return v.trim();
        return v;
    });
};

////////////////////////////////////////////////
// Validator shortcuts
////////////////////////////////////////////////
SchemaType.prototype.min = function setMin(val, message) {
    if (this.minValidator) {
        this.validators = this.validators.filter(function (v) {
            return v[0] != this.minValidator;
        }, this);
        this.minValidator = false;
    }

    if (val != null) { //jshint ignore:line
        var msg = message || 'Value must be above minimum of: ' + val;

        this.minValidator = function (v) {
            return v === null || v >= val;
        };
        this.validators.push([this.minValidator, msg, 'min']);
    }

    return this;
};

SchemaType.prototype.max = function setMin(val, message) {
    if (this.maxValidator) {
        this.validators = this.validators.filter(function (v) {
            return v[0] != this.maxValidator;
        }, this);
        this.maxValidator = false;
    }

    if (val != null) { //jshint ignore:line
        var msg = message || 'Value must be above minimum of: ' + val;

        this.maxValidator = function (v) {
            return v === null || v <= val;
        };
        this.validators.push([this.maxValidator, msg, 'max']);
    }

    return this;
};

SchemaType.prototype.match = function setMatch(rgx, message) {
    var msg = message || 'Value must match: ' + rgx;

    function matchValidator (v) {
        return v != null && v !== '' ? rgx.text(v) : true;
    }

    this.validators.push([matchValidator, msg, 'regexp']);
    return this;
}

SchemaType.prototype.enum = function () {
    if (this.enumValidator) {
        this.validators = this.validators.filter(function (v) {
            return v[0] != this.enumValidator;
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
    } else {
        values = arguments;
        errorMessage = 'Value must be within defined enum: ';
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
SchemaType.prototype.applyGetters = function applyGetters(value, scope) {
    var v = value;
    for (var l = this.getters.length - 1; l >= 0; --l) {
        v = this.getters[l].call(scope, v, this);
    }

    return v;
};

SchemaType.prototype.applySetters = function applySetters(value, scope) {
    var v = value;
    for (var l = this.setters.length - 1; l >= 0; --l) {
        v = this.setters[l].call(scope, v, this);
    }

    return v;
};

SchemaType.prototype.applyValidators = function applyValidators(value, fn, scope) {
    var err = false,
        path = this.path,
        count = this.validators.length;

    if (!count) return fn(null);

    function validate(ok, message, type, val) {
        if (err) return;
        if (ok === undefined || ok) {
            --count || fn(null);
        } else {
            fn(err = new Error('Invalid value for path: ' + path));
        }
    }

    this.validators.forEach(function (v) {
        var validator = v[0],
            message = v[1],
            type = v[2];

        if (validator instanceof RegExp) {
            validate(validator.test(value), message, type, value);
        } else if (typeof validator === 'function') {
            if (validator.length === 2) {
                validator.call(scope, value, function (ok) {
                    validate(ok, message, type, value);
                });
            } else {
                validate(validator.call(scope, value), message, type, value);
            }
        }
    });
};

module.exports = SchemaType;
