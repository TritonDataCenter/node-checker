// Copyright (c) 2013, Joyent, Inc. All rights reserved.

var assert = require('assert-plus');
var Checker = require('./checker');
var net = require('net');
var util = require('util');



///--- Health Checker

function TcpChecker(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.config, 'opts.config');
        assert.object(opts.log, 'opts.log');
        assert.string(opts.config.ip, 'opts.config.ip');
        assert.number(opts.config.port, 'opts.config.port');
        assert.optionalNumber(opts.config.timeout, 'opts.config.timeout');

        var self = this;
        self.config = opts.config;
        self.log = opts.log;
        self.config.timeout = self.config.timeout !== undefined ?
                self.config.timeout : 5000;
}

util.inherits(TcpChecker, Checker);
module.exports = TcpChecker;



///--- Api

TcpChecker.prototype.check = function (cb) {
        var self = this;
        var socket = net.createConnection(self.config.port,
                                          self.config.ip);
        socket.setTimeout(self.config.timeout);

        var error = null;
        socket.on('connect', function () {
                socket.end();
        });

        socket.on('end', function () {
                socket.removeAllListeners();
                cb(error);
        });

        socket.on('timeout', function () {
                socket.removeAllListeners();
                socket.destroy();
                error = new Error();
                error.code = 'Timeout';
                error.timeout = self.config.timeout;
                cb(error);
        });

        socket.on('error', function (err) {
                socket.removeAllListeners();
                socket.destroy();
                error = error || err;
                cb(error);
        });
};


TcpChecker.prototype.label = function () {
        return ('tcp');
};
