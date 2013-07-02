// Copyright (c) 2013, Nate Fitch. All rights reserved.

var assert = require('assert-plus');
var AllCheckers = require('./all_checkers');
var Checker = require('./checkers/checker');
var DnsChecker = require('./checkers/dns_checker');
var HcServer = require('./hc_server');
var HealthChecker = require('./health_checker');
var HttpChecker = require('./checkers/http_checker');
var NoopChecker = require('./checkers/noop_checker');
var TcpChecker = require('./checkers/tcp_checker');



///--- Functions

function createHealthChecker(opts, cb) {
        assert.object(opts, 'opts');
        assert.func(cb, 'cb');

        var hc = new HealthChecker(opts);
        var co = { 'checkers': AllCheckers };
        hc.registerCheckers(co, function (err) {
                if (err) {
                        cb(err);
                        return;
                }
                cb(null, hc);
        });
}


function createAndStartServer(opts, cb) {
        assert.object(opts, 'opts');
        assert.func(cb, 'cb');

        var hs = new HcServer(opts);
        hs.start(function (err) {
                cb(err, hs);
        });
        return (hs);
}


function createServer(opts) {
        assert.object(opts, 'opts');

        var hs = new HcServer(opts);
        return (hs);
}


///--- API

module.exports = {
        AllCheckers: AllCheckers,
        Checker: Checker,
        DnsChecker: DnsChecker,
        HealthChecker: HealthChecker,
        HttpChecker: HttpChecker,
        NoopChecker: NoopChecker,
        TcpChecker: TcpChecker,

        /**
         * Creates a health checker and registers all checkers provided in
         * this package.
         */
        createHealthChecker: createHealthChecker,
        createAndStartServer: createAndStartServer,
        createServer: createServer
};
