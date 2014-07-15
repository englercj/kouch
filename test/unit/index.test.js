var expect = require('chai').expect,
    index = require('../../lib/index.js');

describe('Index', function () {
    it('should export "Hello World!"', function () {
        expect(index).to.equal('Hello World!');
    });
});
