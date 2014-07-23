var expect = require('chai').expect,
    db = require('../fixtures/db'),
    kouch = require('../../lib/'),
    TestSchema = new kouch.Schema({
        _id: String,
        name: String
    }),
    TestModel,
    docs = [
        { _id: 'id1', name: 'test doc 1' },
        { _id: 'id2', name: 'test doc 2' },
        { _id: 'id3', name: 'test doc 3' }
    ],
    noop = function () {};

describe('Kouch.Model', function () {
    before(function (done) {
        TestModel = kouch.model('Test', 'default', TestSchema);

        var docsToInsert = {};
        for (var i = 0; i < docs.length; ++i) {
            docsToInsert['Test:' + docs[i]._id] = { value: docs[i] };
        }

        kouch.buckets.default.insertMulti(docsToInsert, {}, done);
    });

    describe('#ctor', function () {

    });

    describe('#save', function () {
        it('Should save the document', function (done) {
            var mdl = new TestModel({ name: 'John Smith', notInSchema: 'something' });

            mdl.save(function (err) {
                expect(err).to.not.exist;

                expect(mdl.id).to.be.a('string');
                expect(mdl.name).to.equal('John Smith');
                expect(mdl.notInSchema).to.not.exist;
                expect(mdl._doc.notInSchema).to.not.exist;

                done();
            });
        });
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
                expect(model._doc).to.eql(docs[0]);

                done();
            });
        });

        it('Should load multiple documents properly', function (done) {
            TestModel.load(['id1', 'id2'], function (err, models) {
                expect(err).to.not.exist;

                expect(models[0]).to.be.an.instanceOf(TestModel);
                expect(models[0]._id).to.equal('id1');
                expect(models[0]._doc).to.eql(docs[0]);

                expect(models[1]).to.be.an.instanceOf(TestModel);
                expect(models[1]._id).to.equal('id2');
                expect(models[1]._doc).to.eql(docs[1]);

                done();
            });
        });
    });

    describe('.remove', function () {
        it('Should remove the document properly', function (done) {
            TestModel.remove('id1', function (err) {
                expect(err).to.not.exist;

                TestModel.load('id1', function (err, model) {
                    expect(err).to.be.an.instanceOf(Error);
                    expect(err.message).to.contain('The key does not exist on the server');

                    done();
                });
            });
        });

        it('Should remove multiple documents properly', function (done) {
            TestModel.remove(['id2', 'id3'], function (err) {
                expect(err).to.not.exist;

                TestModel.load('id1', function (err, model) {
                    expect(err).to.be.an.instanceOf(Error);
                    expect(err.message).to.contain('The key does not exist on the server');

                    done();
                });
            });
        });
    });

    describe('.create', function () {
        it('Should create a document properly', function (done) {
            var doc = { _id: 'insert1', name: 'herp' };

            TestModel.create(doc, function (err, model) {
                expect(err).to.not.exist;

                expect(model).to.be.an.instanceOf(TestModel);
                expect(model._id).to.equal('insert1');
                expect(model._doc).to.eql(doc);

                TestModel.load('insert1', function (err, _model) {
                    expect(err).to.not.exist;

                    expect(_model).to.be.an.instanceOf(TestModel);
                    expect(_model._id).to.equal('insert1');
                    expect(_model._doc).to.eql(doc);

                    done();
                });
            });
        });

        it('Should create multiple documents properly', function (done) {
            var docs = [
                { _id: 'multiInsert1', name: 'Multi Insert 1' },
                { _id: 'multiInsert2', name: 'Multi Insert 2' },
                { _id: 'multiInsert3', name: 'Multi Insert 3' },
                { _id: 'multiInsert4', name: 'Multi Insert 4' }
            ];

            TestModel.create(docs, function (err, models) {
                expect(err).to.not.exist;

                expect(models[0]).to.be.an.instanceOf(TestModel);
                expect(models[0]._id).to.equal('multiInsert1');
                expect(models[0]._doc).to.eql(docs[0]);

                expect(models[1]).to.be.an.instanceOf(TestModel);
                expect(models[1]._id).to.equal('multiInsert2');
                expect(models[1]._doc).to.eql(docs[1]);

                expect(models[2]).to.be.an.instanceOf(TestModel);
                expect(models[2]._id).to.equal('multiInsert3');
                expect(models[2]._doc).to.eql(docs[2]);

                TestModel.load(['multiInsert1', 'multiInsert3'], function (err, _model) {
                    expect(err).to.not.exist;

                    expect(models[0]).to.be.an.instanceOf(TestModel);
                    expect(models[0]._id).to.equal('multiInsert1');
                    expect(models[0]._doc).to.eql(docs[0]);

                    expect(models[2]).to.be.an.instanceOf(TestModel);
                    expect(models[2]._id).to.equal('multiInsert3');
                    expect(models[2]._doc).to.eql(docs[2]);

                    done();
                });
            });
        });
    });

    describe('.key', function () {

    });
});
