// Copyright (c) 2013, Joyent, Inc. All rights reserved.

var assert = require('assert-plus');


///--- Health Checker

function Checker(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.config, 'opts.config');
        assert.object(opts.log, 'opts.log');

        var self = this;
        self.config = opts.config;
        self.log = opts.log;
}

module.exports = Checker;



///--- Api

Checker.prototype.check = function (cb) {
        cb(null);
};

Checker.prototype.label = function () {
        throw new Error('label function wasn\'t overridden');
};
