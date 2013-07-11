// Copyright (c) 2013, Nate Fitch. All rights reserved.

var assert = require('assert-plus');
var Checker = require('./checker');
var http = require('http');
var https = require('https');
var util = require('util');



///--- Health Checker

function HttpChecker(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.config, 'opts.config');
        assert.object(opts.log, 'opts.log');
        assert.string(opts.config.ip, 'opts.config.ip');
        assert.string(opts.config.path, 'opts.config.path');
        assert.optionalNumber(opts.config.port, 'opts.config.port');
        assert.optionalBool(opts.config.secure, 'opts.config.secure');
        assert.optionalNumber(opts.config.timeout, 'opts.config.timeout');

        var self = this;
        var c = opts.config;
        self.config = opts.config;
        self.log = opts.log;
        self.timeout = c.timeout !== undefined ? c.timeout : 5000;
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

util.inherits(HttpChecker, Checker);
module.exports = HttpChecker;



///--- Api

HttpChecker.prototype.check = function (cb) {
        var self = this;
        var h = self.config.secure ? https : http;
        var error = null;
        var req = h.get(self.url, function (res) {
                req.removeAllListeners();
                if (res.statusCode >= 300) {
                        error = new Error('status code is >= 300');
                        error.code = res.statusCode;
                }
                cb(error, {
                        'httpStatusCode': res.statusCode
                });
        });
        req.once('error', function (err) {
                req.removeAllListeners();
                error = error || err;
                cb(error);
        });
        req.setTimeout(self.timeout, function () {
                error = new Error();
                error.code = 'Timeout';
                error.timout = self.timeout;
                req.abort();
        });
};

HttpChecker.prototype.label = function () {
        return ('http');
};
