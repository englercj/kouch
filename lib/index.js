var couchbase = require('couchbase'),
    utils = require('./utils'),
    Schema = require('./schema'),
    Model = require('./model');

function Kouch() {
    this.cluster = null;
    this.buckets = {};
    this.models = {};

    this.options = {};
}

/**
 * Sets mongoose options
 *
 * ####Example:
 *
 *     kouch.set('debug', true) // enable logging collection methods + arguments to the console
 *
 * @param key {String}
 * @param value {mixed}
 * @api public
 */
Kouch.prototype.set = function (key, value) {
    if (arguments.length === 1) {
        return this.options[key];
    }

    this.options[key] = value;
    return this;
};

Kouch.prototype.get = Kouch.prototype.set;

/**
 * Opens a connection to a cluster.
 *
 * @method connect
 * @param dsn {String|Object} The connection string or an object with the proper properties.
 * @param [buckets] {Array<Object>} The bucket connection object (name/password).
 * @return {couchbase.Bucket}
 */
Kouch.prototype.connect = function (dsn, buckets, mock) {
    this.cluster = new couchbase.Cluster(dsn);

    // nothing passed, assume they want the default bucket
    if (!buckets) {
        buckets = { name: 'default' };
    }
    // string bucket name passed, parse into object
    else if (typeof buckets === 'string') {
        buckets = { name: buckets };
    }

    // catch the case of something strange being passed in...
    if (typeof buckets !== 'object') {
        throw new TypeError('Connection bucket must be a string, object { name, password }, or array of objects.');
    }

    // if an array is passed, open each one.
    if (buckets.length) {
        for (var i = 0; i < buckets.length; ++i) {
            var b = buckets[i];

            if (typeof b === 'string') {
                this.openBucket(b, null, mock);
            } else {
                this.openBucket(b.name, b.password, mock);
            }
        }
    }
    // assume it is an object of form { name, password }
    else {
        this.openBucket(buckets.name, buckets.password, mock);
    }

    return this.cluster;
};

/**
 * Disconnect from a specific bucket or from all buckets.
 *
 * @method disconnect
 * @param [name] {String} The name of the bucket to disconnect from, if none is passed all buckets are disconnected.
 */
Kouch.prototype.disconnect = function (name) {
    var buckets = this.buckets;

    if (name) {
        buckets[name].shutdown();
    } else {
        Object.keys(buckets).forEach(function (name) {
            buckets[name].shutdown();
        });
    }
};

/**
 * Opens a connection to a new bucket on the cluster.
 *
 * @method openBucket
 * @param name {String} The string name of the bucket.
 * @param bucket {String} The password to use to login.
 * @return {couchbase.Bucket}
 */
Kouch.prototype.openBucket = function (name, password, mock) {
    if (this.buckets[name]) {
        return this.buckets[name];
    }

    if (!mock) {
        return this.buckets[name] = this.cluster.openBucket(name, password);
    } else {
        return this.buckets[name] = new couchbase.Mock.Connection({});
    }
};

/**
 * Creates a model based on a schema for a certain bucket.
 *
 * @method model
 * @param name {String} The string name of the model.
 * @param bucket {String} The name of the bucket to use.
 * @param schema {Schema|Object} The schema object to use.
 * @return {Model}
 */
Kouch.prototype.model = function (name, bucket, schema) {
    if (utils.isObject(schema) && !(schema instanceof Schema)) {
        schema = new Schema(schema);
    }

    if (!this.models[name]) {
        this.models[name] = {};
    }

    // if we have a model for this name/bucket then return it
    if (this.models[name][bucket]) {
        if (schema instanceof Schema && schema !== this.models[name][bucket].schema) {
            throw new Error(
                'Passed schema does not match a previously create model for: ' + name + ', in bucket: ' + bucket
            );
        }

        return this.models[name][bucket];
    }

    // create a new model for this bucket and save it
    return this.models[name][bucket] = Model.compile(name, bucket, this.buckets[bucket], schema, this);
};

Kouch.prototype.Schema = Schema;

module.exports = new Kouch();
