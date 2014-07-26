# Kouch

Couchbase ODM heavily inspired by [`mongoose`][0].

**WARNING:** Still heavily in development, incomplete, and only lightly tested.

[0]: https://github.com/LearnBoost/mongoose

## Example

Here is an example of a `User` model that is stored in the `default` bucket and shows off many of the features of kouch:

```javascript
// create the base schema
UserSchema = new kouch.Schema({
    name: {
        first: String,
        last: String
    },
    email:    String,
    password: String,
    age:      { type: Number, min: 18 },
    bio:      { type: String, match: /[\w\d]+/, trim: true },
    date:     { type: Date, default: Date.now  }
});

// set the key prefix for when a comment is stored
UserSchema.set('key.prefix', 'user:account:');

// a setter for the first name that capitalizes it
UserSchema.path('name.first').set(function (val) {
    return val.substr(0, 1).toUpperCase() + val.substr(1);
});

// middleware
UserSchema.pre('save', function (next) {
    var user = this;

    // only hash the password if the password has changed
    if (!this.isModified('password')) {
        return next();
    }

    bcrypt.hash(user.password, 8, function(err, hash) {
        if (err) return next(err);

        user.password = hash;
        next();
    });
});

// instance methods on an instance of the model created from this schema
// will be accessible at: (new UserModel()).x
UserSchema.methods.x = function (cb) {
    // need a good example here...
};

// static method on the model created from this schema
// will be accessible at: UserModel.x
UserSchema.statics.x = function (name, cb) {
    // need a good example here...
};

// virtual property, not persisted to the DB
UserSchema.virtual('name.full')
    .get(function () {
        return this.name.first + ' ' + this.name.last;
    })
    .set(function (name) {
        var split = name.split(' ');
        this.name.first = split[0];
        this.name.last = split[1];
    });


// create the model from the schema
var UserModel = kouch.model('User', 'default', UserSchema);

// create an instance of the model with data
var user = new UserModel({
    name: {
        first: 'Chad',
        last: 'Engler'
    },
    email: 'me@somewhere.com',
    password: 'secret',
    age: 21,
    bio: 'I am a person!'
});


// save the user
user.save();
```

## TODO / Wishlist

- Indexes
- Queries
- Views
- Ref Docs
- [DONE] ~~Required / Optional fields~~
- [DONE] ~~isModified state for fields~~
- If a bucket is not specified, use 'default'

## License

The MIT License (MIT)

Copyright (c) 2014 Chad Engler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
