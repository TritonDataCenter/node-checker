// Copyright (c) 2013, Joyent, Inc. All rights reserved.

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
        assert.optionalBool(opts.config.rejectUnauthorized,
            'opts.config.rejectUnauthorized');

        var self = this;
        var c = opts.config;
        self.config = opts.config;
        self.log = opts.log;
        self.timeout = c.timeout !== undefined ? c.timeout : 5000;
        self.rqoptions = {
            'host': c.ip,
            'path': c.path.charAt(0) === '/' ? c.path : '/' + c.path
        };
        if (c.port) {
                self.rqoptions.port = c.port;
        }
        if (c.hasOwnProperty('rejectUnauthorized')) {
                self.rqoptions.rejectUnauthorized = c.rejectUnauthorized;
        }

        self.log.info({
                rqoptions: self.rqoptions
        }, 'inited http checker');
}

util.inherits(HttpChecker, Checker);
module.exports = HttpChecker;



///--- Api

HttpChecker.prototype.check = function (cb) {
        var self = this;
        var h = self.config.secure ? https : http;
        var error = null;
        var req = h.get(self.rqoptions, function (res) {
                req.removeAllListeners();
                if (res.statusCode >= 300) {
                        error = new Error('status code is >= 300');
                        error.code = res.statusCode;
                }
                /*
                 * There is an unfortunate side-effect here: without the
                 * data listener, no data is consumed from the connection,
                 * and the end-listener will never be called. The unconsumed
                 * data is leaked, and the underlying TCP socket is left in
                 * CLOSE_WAIT. So we add an "empty" data-listener: it consumes
                 * inbound response-data, preventing the leak.
                 */
                res.on('data', function (d) { /* consume */});

                res.on('end', function () {
                        cb(error, {
                                'httpStatusCode': res.statusCode,
                                'httpResponseLength' : res.socket.bytesRead
                        });
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
