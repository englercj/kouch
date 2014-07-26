var kouch = require('../../lib/'),
    noop = function () {};

// TODO: Mock the couchbase server, right now a real instance is needed...
exports.before = function () {
    kouch.connect('couchbase://192.168.0.12', { name: 'default' });
};

exports.after = function () {
    kouch.buckets.default.flush(noop);
    kouch.disconnect();
};

//mocha hooks
before(exports.before);
after(exports.after);
