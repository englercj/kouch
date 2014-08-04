var expect = require('chai').expect,
    db = require('../fixtures/db'),
    kouch = require('../../lib/'),
    TestSchema = new kouch.Schema({
        _id: { type: String, key: true, auto: 'uuid' },
        name: String
    }),
    TestModel,
    docs = [
        { _id: 'load1', name: 'test doc 1' },
        { _id: 'load2', name: 'test doc 2' },
        { _id: 'load3', name: 'test doc 3' },
        { _id: 'remove1', name: 'test doc 1' },
        { _id: 'remove2', name: 'test doc 2' },
        { _id: 'remove3', name: 'test doc 3' }
    ],
    noop = function () {};

describe('Kouch.Model', function () {
    before(function (done) {
        TestModel = kouch.model('ModelTest', 'default', TestSchema);

        var docsToInsert = {};
        for (var i = 0; i < docs.length; ++i) {
            docsToInsert[TestModel.key(docs[i]._id)] = { value: docs[i] };
        }

        kouch.buckets.default.insertMulti(docsToInsert, {}, function (err, result) {
            if(err) console.log(result);
            done(err);
        });
    });

    describe('#ctor', function () {

    });

    describe('#save', function () {
        it('Should save the document', function (done) {
            var mdl = new TestModel({ name: 'John Smith', notInSchema: 'something' });

            mdl.save(function (err) {
                expect(err).to.not.exist;

                expect(mdl._id).to.be.a('string');
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

    describe('#toObject', function () {
        it('Should properly serialize the model', function () {
            var doc = { _id: 'something', name: 'le test', notInSchema: 'me' },
                result = { _id: 'something', name: 'le test' },
                model = new TestModel(doc);

            expect(model.toObject()).to.eql(result);
        });
    });

    describe('#toJSON', function () {
        it('Should properly serialize the model', function () {
            var doc = { _id: 'something', name: 'le test', notInSchema: 'me' },
                result = { _id: 'something', name: 'le test' },
                model = new TestModel(doc);

            expect(JSON.stringify(model)).to.equal(JSON.stringify(result));
        });
    });

    describe('#model', function () {

    });

    describe('#isModified', function () {
        it('Should be modified when created from an object', function () {
            var doc = { _id: 'modifiedTest', name: 'modified' },
                model = new TestModel(doc);

            expect(model.isModified()).to.be.true;
        });

        it('Should not be modified when initially loaded', function (done) {
            TestModel.load('load1', function (err, model) {
                expect(err).to.not.exist;
                expect(model.isModified()).to.be.false;
                done(err);
            });
        });

        it('Should set properly check the modified state of a single path', function () {
            var doc = { _id: 'modifiedTest', name: 'not modified' },
                model = new TestModel(doc);

            expect(model.isModified()).to.be.true;

            model.resetModified('name');

            expect(model.isModified()).to.be.true;
            expect(model.isModified('_id')).to.be.true;
            expect(model.isModified('name')).to.be.false;
        });
    });

    describe('#modifiedPaths', function () {
        it('Should return all the paths that are modified', function (done) {
            TestModel.load('load1', function (err, model) {
                expect(err).to.not.exist;
                expect(model.modifiedPaths()).to.be.empty;

                model.name = 'CHANGED';

                expect(model.modifiedPaths()).to.eql(['name']);
                done(err);
            });
        });
    });

    describe('#setModified', function () {
        it('Should set the path as modified', function () {
            var doc = { _id: 'modifiedTest', name: 'not modified' },
                model = new TestModel(doc);

            expect(model.isModified()).to.be.true;

            model.resetModified();

            expect(model.isModified()).to.be.false;

            model.setModified('_id');

            expect(model.isModified()).to.be.true;
            expect(model.isModified('_id')).to.be.true;
            expect(model.isModified('name')).to.be.false;
        });
    });

    describe('#resetModified', function () {
        it('Should set reset the modified state of the entire model', function () {
            var doc = { _id: 'modifiedTest', name: 'not modified' },
                model = new TestModel(doc);

            expect(model.isModified()).to.be.true;

            model.resetModified();

            expect(model.isModified()).to.be.false;
        });

        it('Should set reset the modified state of a single path', function () {
            var doc = { _id: 'modifiedTest', name: 'not modified' },
                model = new TestModel(doc);

            expect(model.isModified()).to.be.true;

            model.resetModified('name');

            expect(model.isModified()).to.be.true;
            expect(model.isModified('_id')).to.be.true;
            expect(model.isModified('name')).to.be.false;
        });
    });

    ///////
    // Statics
    ///////

    describe('.compile', function () {

    });

    describe('.load', function () {
        it('Should load the proper document', function (done) {
            TestModel.load('load1', function (err, model) {
                expect(err).to.not.exist;
                expect(model).to.be.an.instanceOf(TestModel);

                expect(model._id).to.equal('load1');
                expect(model._doc).to.eql(docs[0]);

                done();
            });
        });

        it('Should load multiple documents properly', function (done) {
            TestModel.load(['load1', 'load2'], function (err, models) {
                expect(err).to.not.exist;

                expect(models[0]).to.be.an.instanceOf(TestModel);
                expect(models[0]._id).to.equal('load1');
                expect(models[0]._doc).to.eql(docs[0]);

                expect(models[1]).to.be.an.instanceOf(TestModel);
                expect(models[1]._id).to.equal('load2');
                expect(models[1]._doc).to.eql(docs[1]);

                done();
            });
        });
    });

    describe('.remove', function () {
        it('Should remove the document properly', function (done) {
            TestModel.remove('remove1', function (err) {
                expect(err).to.not.exist;

                TestModel.load('remove1', function (err, model) {
                    expect(err).to.be.an.instanceOf(Error);
                    expect(err.message).to.contain('The key does not exist on the server');

                    done();
                });
            });
        });

        it('Should remove multiple documents properly', function (done) {
            TestModel.remove(['remove2', 'remove3'], function (err) {
                expect(err).to.not.exist;

                TestModel.load('remove3', function (err, model) {
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
            var _docs = [
                { _id: 'multiInsert1', name: 'Multi Insert 1' },
                { _id: 'multiInsert2', name: 'Multi Insert 2' },
                { _id: 'multiInsert3', name: 'Multi Insert 3' },
                { _id: 'multiInsert4', name: 'Multi Insert 4' }
            ];

            TestModel.create(_docs, function (err, models) {
                expect(err).to.not.exist;

                expect(models[0]).to.be.an.instanceOf(TestModel);
                expect(models[0]._id).to.equal('multiInsert1');
                expect(models[0]._doc).to.eql(_docs[0]);

                expect(models[1]).to.be.an.instanceOf(TestModel);
                expect(models[1]._id).to.equal('multiInsert2');
                expect(models[1]._doc).to.eql(_docs[1]);

                expect(models[2]).to.be.an.instanceOf(TestModel);
                expect(models[2]._id).to.equal('multiInsert3');
                expect(models[2]._doc).to.eql(_docs[2]);

                TestModel.load(['multiInsert1', 'multiInsert3'], function (err, _model) {
                    expect(err).to.not.exist;

                    expect(models[0]).to.be.an.instanceOf(TestModel);
                    expect(models[0]._id).to.equal('multiInsert1');
                    expect(models[0]._doc).to.eql(_docs[0]);

                    expect(models[2]).to.be.an.instanceOf(TestModel);
                    expect(models[2]._id).to.equal('multiInsert3');
                    expect(models[2]._doc).to.eql(_docs[2]);

                    done();
                });
            });
        });
    });

    describe('.key', function () {

    });
});
