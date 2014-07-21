var expect = require('chai').expect,
    kouch = require('../../lib/');

describe('Kouch', function () {
    before(function () {
        kouch.connect(null, { name: 'test', password: '' }, true);
    });

    after(function () {
        kouch.disconnect();
    });

    it('General case usage', function () {
        var getDate = function (val) {
            return (val.getMonth() + 1) + "/" + val.getDate() + "/" + val.getFullYear();
        };

        var CommentSchema = new kouch.Schema({
            name: {
                first: { type: String, default: 'first' },
                last: String
            },
            age : { type: Number, min: 18 },
            bio : { type: String, match: /[a-z]/ },
            date: { type: Date, default: Date.now, get: getDate  },
            buff: Buffer,
            body: String
        });

        // set some options on how the key is constructed
        CommentSchema.set('key.prefix', 'comments');
        CommentSchema.set('key.delimeter', ':');

        // a setter
        CommentSchema.path('name.first').set(function (val) {
            return val.substr(0, 1).toUpperCase() + val.substr(1);
        });

        // a getter
        CommentSchema.path('bio').get(function (val) {
            return val.trim();
        });

        // middleware
        CommentSchema.pre('save', function (next) {
            this.name.first += '-pre-save';
            // notify(this.get('email'));
            expect(this.name.first).to.equal('Brittany-pre-save');
            next();
        });

        // instance methods on a created model
        CommentSchema.methods.findSimilarTypes = function (cb) {
            // return this.model('Animal').find({ type: this.type }, cb);
        };

        // static method on the model created from this schema
        CommentSchema.statics.findByName = function (name, cb) {
            // this.find({ name: new RegExp(name, 'i') }, cb);
        };

        // virtual property that is not persisted to the DB
        CommentSchema.virtual('name.full')
            .get(function () {
                return this.name.first + ' ' + this.name.last;
            })
            .set(function (name) {
                var split = name.split(' ');
                this.name.first = split[0];
                this.name.last = split[1];
            });


        // create the model from the schema
        var CommentModel = kouch.model('Comment', 'test', CommentSchema);

        var doc,
            comment = new CommentModel(doc = {
                name: {
                    first: 'Chad',
                    last: 'Engler'
                },
                age: 21,
                bio: 'I am a person!',
                buff: new Buffer(16),
                body: 'Comment body!'
            });

        // check schema options
        expect(CommentSchema.get('key.prefix')).to.equal('comments');
        expect(CommentSchema.get('key.delimeter')).to.equal(':');

        // check document getters
        expect(comment.name.first).to.equal(doc.name.first);
        expect(comment.name.last).to.equal(doc.name.last);
        expect(comment.age).to.equal(doc.age);
        expect(comment.bio).to.equal(doc.bio);
        expect(comment.date).to.be.equal(getDate(new Date())); //getter modifies the value
        expect(comment.buff).to.equal(doc.buff);
        expect(comment.body).to.equal(doc.body);

        // check bio getter
        comment.bio = '       space         ';
        expect(comment.bio).to.equal('space');

        // check methods
        expect(comment.findSimilarTypes).to.be.a('function');

        // check statics
        expect(CommentModel.findByName).to.be.a('function');

        // check virtual getter
        expect(comment.name.full).to.equal('Chad Engler');

        // check setter method
        comment.name.first = 'john';
        expect(comment.name.first).to.equal('John'); //setter modifies the value

        // check virtual setter
        comment.name.full = 'Brittany Engler';
        expect(comment.name.first).to.equal('Brittany');
        expect(comment.name.last).to.equal('Engler');
        expect(comment.name.full).to.equal('Brittany Engler');

        // check saving
        comment.save();
    });
});