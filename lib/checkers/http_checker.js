// Copyright (c) 2013, Nate Fitch. All rights reserved.

var assert = require('assert-plus');
var http = require('http');
var https = require('https');



///--- Health Checker

function HttpChecker(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.config, 'opts.config');
        assert.object(opts.log, 'opts.log');
        assert.string(opts.config.ip, 'opts.config.ip');
        assert.string(opts.config.path, 'opts.config.path');
        assert.optionalNumber(opts.config.port, 'opts.config.port');
        assert.optionalBool(opts.config.secure, 'opts.config.secure');

        var self = this;
        var c = opts.config;
        self.config = opts.config;
        self.log = opts.log;
        self.url = (c.secure === true) ? 'https://' : 'http://';
        self.url += c.ip;
        if (c.port) {
                self.url += ':' + c.port;
        }
        if (c.path.indexOf('/') !== 0) {
                self.url += '/';
        }
        self.url += c.path;
        self.log.info({
                url: self.url
        }, 'inited http checker');
}

module.exports = HttpChecker;



///--- Api

HttpChecker.prototype.check = function (cb) {
        var self = this;
        var h = self.config.secure ? https : http;
        h.get(self.url, function (res) {
                var err = null;
                if (res.statusCode >= 300) {
                        err = new Error('status code is >= 300');
                }
                cb(err, {
                        'httpStatusCode': res.statusCode
                });
        }).once('error', function (err) {
                cb(err);
        });
};
