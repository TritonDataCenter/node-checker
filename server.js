// Copyright 2013 Nate Fitch, All rights reserved.

var bunyan = require('bunyan');
var express = require('express');
var fs = require('fs');
var getopt = require('posix-getopt');
var lib = require('./lib');
var path = require('path');
var vasync = require('vasync');



//--- Globals

var DEFAULT_PORT = 8080;
var LOG = bunyan.createLogger({
        level: (process.env.LOG_LEVEL || 'info'),
        name: 'checker',
        stream: process.stdout
});
var HEALTH_CHECKER = null;



//--- Handlers

function handleCheckerRequest(req, res) {
        if (!HEALTH_CHECKER) {
                res.send(JSON.stringify({
                        'code': 'CheckerNotConfigured',
                        'message': 'The health checker is not configured on ' +
                                'this server.'
                }));
                return;
        }

        var stats = JSON.stringify(HEALTH_CHECKER.getStats());
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


function usage(msg) {
        if (msg) {
                console.error(msg);
        }
        var str  = 'usage: ' + path.basename(process.argv[1]);
        str += ' [-c config_file]';
        str += ' [-p port]';
        console.error(str);
        process.exit(1);
}


function parseOptions() {
        var option;
        var opts = {
                'configFiles': [],
                'port': 8080
        };
        var parser = new getopt.BasicParser('c:p:',
                                            process.argv);
        while ((option = parser.getopt()) !== undefined && !option.error) {
                switch (option.option) {
                case 'c':
                        opts.configFiles.push(option.optarg);
                        break;
                case 'p':
                        opts.port = parseInt(option.optarg, 10);
                        break;
                default:
                        usage('Unknown option: ' + option.option);
                        break;
                }
        }

        if (opts.configFiles.length === 0) {
                usage('No config files specified.');
        }

        return (opts);
}



//--- Main

var opts = parseOptions();

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
                function createChecker(_, subcb) {
                        var o = { log: LOG };
                        lib.createHealthChecker(o, function (err, c) {
                                if (err) {
                                        subcb(err);
                                        return;
                                }
                                HEALTH_CHECKER = c;
                                subcb();
                        });
                },
                function loadConfigs(_, subcb) {
                        var i = 0;
                        function loadNextConfig() {
                                var f = opts.configFiles[i];
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
                                HEALTH_CHECKER.registerFromConfig(c, reged);
                        }
                        loadNextConfig();
                },
                function startChecker(_, subcb) {
                        LOG.info('starting checker...');
                        HEALTH_CHECKER.start(subcb);
                },
                function startServer(_, subcb) {
                        LOG.info({ port: opts.port }, 'Starting server...');
                        app.listen(opts.port);
                        subcb();
                }
        ]
}, function (err) {
        if (err) {
                LOG.fatal(err, 'failed to start server');
        }
});
