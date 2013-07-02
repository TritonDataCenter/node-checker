// Copyright (c) 2013, Nate Fitch. All rights reserved.

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
        assert.optionalNumber(opts.config.port, 'opts.config.port');

        var self = this;
        self.config = opts.config;
        self.log = opts.log;
}

util.inherits(TcpChecker, Checker);
module.exports = TcpChecker;



///--- Api

TcpChecker.prototype.check = function (cb) {
        var self = this;
        var socket = net.createConnection(self.config.port,
                                          self.config.ip);

        socket.on('connect', function () {
                socket.end();
        });

        socket.on('end', function () {
                socket.removeAllListeners();
                cb(null);
        });

        socket.on('error', function (err) {
                socket.removeAllListeners();
                cb(err);
        });
};


TcpChecker.prototype.label = function () {
        return ('tcp');
};
