var expect = require('chai').expect,
    kouch = require('../../lib/'),
    TestSchema = new kouch.Schema({
        _id: String,
        name: String
    }),
    TestModel,
    test;

describe('Kouch.Model', function () {
    before(function (done) {
        kouch.connect('dsn', { name: 'test', password: 'test' }, true);

        TestModel = kouch.model('Test', 'test', TestSchema);

        kouch.buckets.test.add('Test:id1', { _id: 'id1', name: 'test doc 1' }, function () {});
        kouch.buckets.test.add('Test:id2', { _id: 'id2', name: 'test doc 2' }, function () {});
        kouch.buckets.test.add('Test:id3', { _id: 'id3', name: 'test doc 3' }, function () {});

        setTimeout(done, 50);
    });

    describe('#ctor', function () {

    });

    describe('#save', function () {

    });

    describe('#remove', function () {

    });

    describe('#validate', function () {

    });

    describe('#getValue', function () {

    });

    describe('#setValue', function () {

    });

    describe('#get', function () {

    });

    describe('#set', function () {

    });

    ///////
    // Statics
    ///////

    describe('.compile', function () {

    });

    describe('.toJSON', function () {

    });

    describe('.load', function () {
        it('Should load the proper document', function (done) {
            TestModel.load('id1', function (err, model) {
                expect(err).to.not.exist;
                expect(model).to.be.an.instanceOf(TestModel);

                expect(model._id).to.equal('id1');
            });
        });
    });

    describe('.loadMulti', function () {

    });

    describe('.remove', function () {

    });

    describe('.removeMulti', function () {

    });

    describe('.create', function () {

    });

    describe('.key', function () {

    });
});
