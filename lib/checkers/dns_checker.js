// Copyright (c) 2013, Nate Fitch. All rights reserved.

var assert = require('assert-plus');
var Checker = require('./checker');
var dns = require('native-dns');
var util = require('util');



///--- Health Checker

function DnsChecker(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.config, 'opts.config');
        assert.object(opts.log, 'opts.log');
        assert.string(opts.config.ip, 'opts.config.ip');
        assert.optionalNumber(opts.config.port, 'opts.config.port');
        assert.string(opts.config.domainName, 'opts.config.domainName');
        assert.optionalNumber(opts.config.timeout, 'opts.config.timeout');

        var self = this;
        self.config = opts.config;
        self.log = opts.log;
}

util.inherits(DnsChecker, Checker);
module.exports = DnsChecker;



///--- Api

DnsChecker.prototype.check = function (cb) {
        var self = this;
        var host = self.config.ip;
        var port = self.config.port || 53;
        var domainName = self.config.domainName;
        var timeout = self.config.timeout !== undefined ?
                self.config.timeout : 5000;

        var question = dns.Question({
                name: domainName,
                type: 'A'
        });

        var req = dns.Request({
                question: question,
                server: { address: host, port: port, type: 'udp' },
                timeout: timeout,
                cache: false
        });

        var error;
        var answers = [];
        req.on('timeout', function () {
                error = new Error('timed out');
                error.code = 'Timeout';
                error.timeout = timeout;
        });

        req.on('message', function (err, answer) {
                if (err) {
                        error = err;
                        return;
                }
                answer.answer.forEach(function (a) {
                        answers.push(a.address);
                });
        });

        req.on('end', function () {
                if (error) {
                        cb(error);
                        return;
                }
                cb(null, {
                        'answers': answers
                });
        });

        req.send();
};


DnsChecker.prototype.label = function () {
        return ('dns');
};
