// Copyright (c) 2013, Joyent, Inc. All rights reserved.

var Checker = require('./checkers/checker');
var DnsChecker = require('./checkers/dns_checker');
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


///--- API

module.exports = AllCheckers;
