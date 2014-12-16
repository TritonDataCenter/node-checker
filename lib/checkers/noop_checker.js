// Copyright (c) 2013, Joyent, Inc. All rights reserved.

var assert = require('assert-plus');
var Checker = require('./checker');
var util = require('util');

///--- Health Checker

function NoopChecker(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.config, 'opts.config');
        assert.object(opts.log, 'opts.log');

        var self = this;
        self.config = opts.config;
        self.log = opts.log;
}

util.inherits(NoopChecker, Checker);
module.exports = NoopChecker;



///--- Api

NoopChecker.prototype.label = function () {
        return ('noop');
};
