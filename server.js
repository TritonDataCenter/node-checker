// Copyright 2013 Nate Fitch, All rights reserved.

var bunyan = require('bunyan');
var express = require('express');
var fs = require('fs');
var vasync = require('vasync');

//Health Check
var Checker = require('./lib/health_checker');
var DnsChecker = require('./lib/checkers/dns_checker');
var HttpChecker = require('./lib/checkers/http_checker');
var NoopChecker = require('./lib/checkers/noop_checker');
var TcpChecker = require('./lib/checkers/tcp_checker');



//--- Globals

var DEFAULT_PORT = 8080;
var LOG = bunyan.createLogger({
        level: (process.env.LOG_LEVEL || 'info'),
        name: 'checker',
        stream: process.stdout
});
var CHECKER_CONFIG_FILE = process.env.CHECKER_CONFIG_FILE;
var CHECKER_HOSTS_FILE = process.env.CHECKER_HOSTS_FILE;
var CHECKER = null;



//--- Handlers

function handleCheckerRequest(req, res) {
        if (!CHECKER) {
                res.send(JSON.stringify({
                        'code': 'CheckerNoeConfigured',
                        'message': 'The health checker is not configured on ' +
                                'this server.'
                }));
                return;
        }

        var stats = JSON.stringify(CHECKER.getStats());
        res.send(stats);
}


function handlePingRequest(req, res) {
        res.send('Ok.');
}


function audit(req, res, next) {
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
                LOG.info(aobj, 'audit');
        });
        next();
}


function registerCheckers(checker, cb) {
        if (!checker) {
                cb();
                return;
        }
        vasync.pipeline({
                'funcs': [
                        function loadDnsChecker(_, subcb) {
                                CHECKER.registerChecker({
                                        'label': 'dns',
                                        'checker': DnsChecker
                                }, subcb);
                        },
                        function loadHttpChecker(_, subcb) {
                                CHECKER.registerChecker({
                                        'label': 'http',
                                        'checker': HttpChecker
                                }, subcb);
                        },
                        function loadNoopChecker(_, subcb) {
                                CHECKER.registerChecker({
                                        'label': 'noop',
                                        'checker': NoopChecker
                                }, subcb);
                        },
                        function loadTcpChecker(_, subcb) {
                                CHECKER.registerChecker({
                                        'label': 'tcp',
                                        'checker': TcpChecker
                                }, subcb);
                        }
                ]
        }, function (err) {
                cb(err);
        });
}



//--- Main

var port = parseInt(process.argv[2], 10) || DEFAULT_PORT;

var app = express();

//Audit
app.use(audit);
app.get('/checker', handleCheckerRequest);
app.get('/ping', handlePingRequest);

//Route everything else to the static directory.
app.use(express.static(__dirname + '/static'));

// Start the checker, then the server
vasync.pipeline({
        'funcs': [
                function initChecker(_, subcb) {
                        if (!CHECKER_CONFIG_FILE && !CHECKER_HOSTS_FILE) {
                                LOG.fatal({
                                        checkerConfigFile: CHECKER_CONFIG_FILE,
                                        checkerHostsFile: CHECKER_HOSTS_FILE
                                }, 'env vars not specified, not starting ' +
                                         'checker.');
                                subcb(new Error (
                                        'Config files aren\'t present'));
                                return;
                        }
                        LOG.info({
                                checkerConfigFile: CHECKER_CONFIG_FILE,
                                checkerHostsFile: CHECKER_HOSTS_FILE
                        }, 'env vars for checker.');
                        var cfg;
                        var hosts;
                        try {
                                cfg = JSON.parse(fs.readFileSync(
                                        CHECKER_CONFIG_FILE));
                                hosts = JSON.parse(fs.readFileSync(
                                        CHECKER_HOSTS_FILE));
                        } catch (err) {
                                subcb(err);
                                return;
                        }
                        CHECKER = new Checker({ log: LOG });
                        //Kinda hacky...
                        CHECKER._loadedCfg = cfg;
                        CHECKER._loadedHostsCfg = hosts;
                        registerCheckers(CHECKER, subcb);
                },
                function registerCheckerCfg(_, subcb) {
                        CHECKER.registerFromConfig(CHECKER._loadedCfg, subcb);
                },
                function registerCheckerHostCfg(_, subcb) {
                        CHECKER.registerFromConfig(CHECKER._loadedHostsCfg,
                                                   subcb);
                },
                function startChecker(_, subcb) {
                        LOG.info('starting checker...');
                        CHECKER.start(subcb);
                },
                function startServer(_, subcb) {
                        LOG.info({ port: port }, 'Starting server...');
                        app.listen(port);
                        subcb();
                }
        ]
}, function (err) {
        if (err) {
                LOG.fatal(err, 'failed to start server');
        }
});
