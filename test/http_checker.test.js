// Copyright (c) 2017, Joyent, Inc. All rights reserved.

/*
 * Simple test of the http-checker.
 *
 * This test starts up a server, then verifies that the checker
 * generates the expected output based on some statically-configured
 * URLs. The goal is to exercise each case in http-checker (e.g. when
 * the server takes a long time to respond, the checker should
 * generate a timeout).
 */

var bunyan = require('bunyan');
var helper = require('./helper.js');
var http = require('http');
var checker = require('../lib');
var HttpChecker = require('../lib/checkers/http_checker');
var nodeunit = require('nodeunit');

var test = helper.test;
var bigResponse = new Buffer(Array(16*1024*1024)).toString('base64');
var server = http.createServer(function (req, res) {
        if (req.url === '/path/to/probe') {
                res.writeHead(200, {'Content-type':'text/plain'});
                res.end('still alive\n');
        } else if (req.url === '/path/to/size') {
                res.writeHead(200, {'Content-type':'text/plain'});
                res.end(bigResponse);
        } else if (req.url === '/path/to/slowness') {
                /*
                 * The value 5000ms is arbitrary. It just needs to be
                 * longer than the timeout used for the timeout-path
                 * test below.
                 */
                setTimeout(function () {
                        res.writeHead(200, {'Content-type':'text/plain'});
                        res.end('still alive after all this time\n');
                }, 5000);
        } else {
                res.writeHead(404, {'Content-type':'text/plain'});
                res.end('not found\n');
        }
});

helper.before(function(cb) {
        server.listen(0, '127.0.0.1', cb);
});

helper.after(function(cb) {
        server.close(cb);
});



var logger = bunyan.createLogger({
        level: (process.env.LOG_LEVEL || 'debug'),
        name: 'checker',
        stream: process.stdout
});

function getCheckerOpts() {
        var opts = {};
        opts.config = {};
        opts.config.ip = '127.0.0.1';
        opts.config.secure = false;
        opts.log = logger;

        opts.config.port = server.address().port;

        return (opts);
}

test('valid path', function(t) {
        var opts = getCheckerOpts();
        opts.config.path = '/path/to/probe';

        httpchecker = new HttpChecker(opts);
        httpchecker.check(function (error, status) {
                t.equal(200, status.httpStatusCode);
                t.done();
        });
});

test('invalid path', function(t) {
        var opts = getCheckerOpts();
        opts.config.path = '/missingpath/to/probe';

        httpchecker = new HttpChecker(opts);
        httpchecker.check(function (error, status) {
                t.equal(404, status.httpStatusCode);
                t.done();
        });
});


test('timeout path', function(t) {
        var opts = getCheckerOpts();
        opts.config.path = '/path/to/slowness';

        /*
         * The timeout value is arbitrary, but needs to be shorter than the
         * "/path/to/slowness" time used by the server (ie we're testing that
         * timeouts occur, and return the appropriate error-code.)
         */
        opts.config.timeout = 1000;

        httpchecker = new HttpChecker(opts);
        httpchecker.check(function (error, status) {
                t.equal(error.code, 'Timeout');
                t.done();
        });
});

test('large response path', function(t) {
        var opts = getCheckerOpts();
        opts.config.path = '/path/to/size';

        /*
         * Save the server-side reference to the connection, so that
         * we can validate that it had its data consumed properly.
         */
        var serverSide = null;
        server.on('connection', function (c) {serverSide = c;});

        httpchecker = new HttpChecker(opts);
        httpchecker.check(function (error, status) {
                /*
                 * Verify that the checker got the right status code
                 * and consumed the entire response (server and client
                 * agree on the bytes-transferred, and both transferred
                 * the body of the response, plus some extra for
                 * headers.)
                 */
                t.equal(200, status.httpStatusCode);
                t.equal(status.httpResponseLength, serverSide.bytesWritten);
                t.ok(status.httpResponseLength > bigResponse.length);
                t.done();
        });
});
