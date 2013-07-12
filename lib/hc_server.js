// Copyright 2013 Nate Fitch, All rights reserved.

var AllCheckers = require('./all_checkers');
var assert = require('assert-plus');
var bunyan = require('bunyan');
var express = require('express');
var events = require('events');
var fs = require('fs');
var HealthChecker = require('./health_checker');
var vasync = require('vasync');



//--- Globals

var DEFAULT_PORT = 8080;



//--- Server

function HcServer(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.log, 'opts.log');
        assert.arrayOfString(opts.configFiles, 'opts.configFiles');
        assert.optionalNumber(opts.port, 'opts.port');
        if (opts.checkers) {
                assert.arrayOfFunc(opts.checkers, 'opts.checkers');
        }

        var self = this;
        self.log = opts.log;
        self.healthChecker = null;
        self.configFiles = opts.configFiles;
        self.port = opts.port || DEFAULT_PORT;
        self.additionalCheckers = opts.checkers;

        self.app = express();
        self.app.use(audit.bind(self));
        self.app.get('/checker', handleCheckerRequest.bind(self));
        self.app.get('/ping', handlePingRequest.bind(self));
        self.app.use(express.static(__dirname + '/../static'));
}

module.exports = HcServer;



//--- Handlers

function handleCheckerRequest(req, res) {
        var self = this;
        if (!self.healthChecker) {
                res.send(JSON.stringify({
                        'code': 'CheckerNotConfigured',
                        'message': 'The health checker is not configured on ' +
                                'this server.'
                }));
                return;
        }

        var stats = JSON.stringify(self.healthChecker.getStats());
        res.send(stats);
}


function handlePingRequest(req, res) {
        res.send('Ok.');
}


function audit(req, res, next) {
        var self = this;
        var start = (new Date()).getTime();
        res.on('finish', function () {
                var end = (new Date()).getTime();
                var remoteAddress = req.socket &&
                        (req.socket.remoteAddress ||
                         (req.socket.socket &&
                          req.socket.socket.remoteAddress));
                var aobj = {
                        audit: true,
                        method: req.method,
                        url: req.url,
                        start: start,
                        latency: end - start,
                        statusCode: res.statusCode,
                        remoteAddress: remoteAddress,
                        headers: req.headers
                };
                self.log.info(aobj, 'audit');
        });
        next();
}


///--- API

HcServer.prototype.start = function (cb) {
        var self = this;
        // Start the checker, then the server
        vasync.pipeline({
                'funcs': [
                        function createChecker(_, subcb) {
                                var o = { 'log': self.log };
                                var hc = new HealthChecker(o);
                                var o2 = { 'checkers': AllCheckers };
                                hc.registerCheckers(o2, function (err) {
                                        if (err) {
                                                subcb(err);
                                                return;
                                        }
                                        self.healthChecker = hc;
                                        subcb();
                                });
                        },
                        function registerAddlCheckers(_, subcb) {
                                if (!self.additionalCheckers) {
                                        subcb();
                                        return;
                                }
                                self.healthChecker.registerCheckers({
                                        'checkers': self.additionalCheckers
                                }, subcb);
                        },
                        function loadConfigs(_, subcb) {
                                var i = 0;
                                function loadNextConfig() {
                                        var f = self.configFiles[i];
                                        if (f === undefined) {
                                                subcb();
                                                return;
                                        }
                                        try {
                                                var j = fs.readFileSync(f);
                                                var c = JSON.parse(j);
                                        } catch (e) {
                                                subcb(e);
                                                return;
                                        }
                                        function reged(err) {
                                                if (err) {
                                                        subcb(err);
                                                        return;
                                                }
                                                ++i;
                                                loadNextConfig();
                                        }
                                        self.healthChecker.registerFromConfig(
                                                c, reged);
                                }
                                loadNextConfig();
                        },
                        function startChecker(_, subcb) {
                                self.log.info('starting checker...');
                                self.healthChecker.start(subcb);
                        },
                        function startServer(_, subcb) {
                                self.log.info({ port: self.port },
                                              'Starting server...');
                                self.app.listen(self.port);
                                subcb();
                        }
                ]
        }, function (err) {
                if (err) {
                        self.log.fatal(err, 'failed to start server');
                        cb(err);
                        return;
                }
                cb();
                return;
        });

};
