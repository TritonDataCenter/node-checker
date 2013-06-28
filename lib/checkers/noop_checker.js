// Copyright (c) 2013, Nate Fitch. All rights reserved.

var assert = require('assert-plus');


///--- Health Checker

function NoopChecker(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.config, 'opts.config');
        assert.object(opts.log, 'opts.log');

        var self = this;
        self.config = opts.config;
        self.log = opts.log;
}

module.exports = NoopChecker;



///--- Api

NoopChecker.prototype.check = function (cb) {
        cb(null);
};
