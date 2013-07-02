// Copyright (c) 2013, Nate Fitch. All rights reserved.

var Checker = require('./checkers/checker');
var DnsChecker = require('./checkers/dns_checker');
var HealthChecker = require('./health_checker');
var HttpChecker = require('./checkers/http_checker');
var NoopChecker = require('./checkers/noop_checker');
var TcpChecker = require('./checkers/tcp_checker');



///--- Functions

var AllCheckers = [
        DnsChecker,
        HttpChecker,
        NoopChecker,
        TcpChecker
];

function createHealthChecker(opts, cb) {
        var hc = new HealthChecker(opts);
        registerAllCheckers(hc, function (err) {
                if (err) {
                        cb(err);
                        return;
                }
                cb(null, hc);
        });
}

function registerAllCheckers(hc, cb) {
        var i = 0;
        function registerNextChecker() {
                var checker = AllCheckers[i];

                if (checker === undefined) {
                        cb(null, hc);
                        return;
                }

                function registered(err) {
                        if (err) {
                                cb(err);
                                return;
                        }
                        ++i;
                        registerNextChecker();
                }

                hc.registerChecker({ 'checker': checker }, registered);
        }
        registerNextChecker();
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
        registerAllCheckers: registerAllCheckers
};
