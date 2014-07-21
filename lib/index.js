var couchbase = require('couchbase'),
    utils = require('./utils'),
    Schema = require('./schema'),
    Model = require('./model');

function Kouch() {
    this.cluster = null;
    this.buckets = {};
    this.models = {};

    this.options = {};
};

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
 * @param [buckets] {Array<Object>} The password to use to login.
 * @return {couchbase.Bucket}
 */
Kouch.prototype.connect = function (dsn, buckets) {
    this.cluster = new couchbase.Cluster(dsn);

    if (!buckets) {
        throw new TypeError('buckets must be an object or an array of objects');
    } else if (buckets.length) {
        for (var i = 0; i < buckets.length; ++i) {
            this.openBucket(buckets[i].name, buckets[i].password);
        }
    } else {
        this.openBucket(buckets.name, buckets.password);
    }

    return this.cluster;
};

/**
 * Opens a connection to a new bucket on the cluster.
 *
 * @method openBucket
 * @param name {String} The string name of the bucket.
 * @param bucket {String} The password to use to login.
 * @return {couchbase.Bucket}
 */
Kouch.prototype.openBucket = function (name, password) {
    if (this.buckets[name]) {
        return this.buckets[name];
    }

    return this.buckets[name] = this.cluster.openBucket(name, password);
};

/**
 * Disconnect from all buckets.
 *
 * @method disconnect
 */
Kouch.prototype.disconnect = function () {
    var buckets = this.buckets;

    Object.keys(buckets).forEach(function (name) {
        buckets[name].shutdown();
    });
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

    var model, sub;

    if (!this.models[name]) {
        this.models[name] = {};
    }

    // if we have a model for this name/bucket then return it
    if (this.models[name][bucket]) {
        if (schema instanceof Schema && schema !== this.models[name][bucket].schema) {
            throw new Error('Passed schema does not match a previously create model for: ' + name + ', in bucket: ' + bucket);
        }

        return this.models[name][bucket];
    }

    // create a new model for this bucket and save it
    return this.models[name][bucket] = Model.compile(name, this.buckets[bucket], schema, this);
};

Kouch.prototype.Schema = Schema;

module.exports = new Kouch();
