var kouch = require('../../lib/');

exports.before = function () {
    kouch.connect('couchbase://192.168.0.12', { name: 'default' }, null, true);
};

exports.after = function () {
    kouch.disconnect();
};

//mocha hooks
before(exports.before);
after(exports.after);
