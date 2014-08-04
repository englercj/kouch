var expect = require('chai').expect,
    kouch = require('../../lib/'),
    TestSchema = new kouch.Schema({
        fieldRequired: { type: String, required: true },
        fieldMin: { type: Number, min: 8 },
        fieldMax: { type: Number, max: 22 },
        fieldMatch: { type: String, match: /[a-zA-z]+/ },
        fieldEnum: { type: String, enum: ['hey', 'there', 'you'] }
    }),
    TestModel = kouch.model('SchemaTypeTest', 'default', TestSchema);

// register our DB middleware
require('../fixtures/db');

describe('Kouch.SchemaType', function () {
    describe('#ctor', function () {

    });

    describe('#cast', function () {

    });

    describe('#get', function () {

    });

    describe('#set', function () {

    });

    describe('#default', function () {

    });

    describe('#validate', function () {

    });

    describe('#getDefault', function () {

    });

    ///////
    // Setter Shortcuts
    ///////

    describe('#lowercase', function () {

    });

    describe('#uppercase', function () {

    });

    describe('#trim', function () {

    });

    ///////
    // Validator shortcuts
    ///////

    describe('#required', function () {
        it('Should fail validation if a required field is missing', function (done) {
            var m = new TestModel({ fieldMin: 10, fieldMax: 20, fieldMatch: 'abc', fieldEnum: 'hey' });

            m.save(function (err) {
                expect(err).to.be.an.instanceOf(Error);
                done();
            });
        });
    });

    describe('#min', function () {

    });

    describe('#max', function () {

    });

    describe('#match', function () {

    });

    describe('#enum', function () {

    });

    ///////
    // Apply functions
    ///////

    describe('#applyGetters', function () {

    });

    describe('#applySetters', function () {

    });

    describe('#applyValidators', function () {

    });

    ///////
    // Statics
    ///////

    describe('.compile', function () {

    });

    describe('.toJSON', function () {

    });
});
