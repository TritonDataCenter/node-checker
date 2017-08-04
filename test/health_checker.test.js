// Copyright (c) 2017, Joyent, Inc. All rights reserved.

/*
 * A very simple health-check test. We implement a "null" healthcheck,
 * configure a pair of them, and then let them go. We wait 11 seconds
 * and verify that we have two check and that they ran.
 *
 */

var bunyan = require('bunyan');
var helper = require('./helper.js');
var HealthChecker = require('../lib/health_checker');
var test = helper.test;

///--- Objects
function TestChecker(opts) {
        var self = this;
        self.opts = opts;
        self.success = (opts.success === undefined) ? true : opts.success;
        self.numChecks = 0;
}

TestChecker.prototype.check = function noopCheck(cb) {
        var self = this;
        ++self.numChecks;
        cb(null, { 'success': self.success });
};

TestChecker.prototype.label = function label() {
        return ('testChecker');
};


///--- Tests

var testCfg = {
        // Processes are monitored a certain way.  In this case, the "test"
        // process has its health checked by the "test checker".  The process
        // type is what links this to processes in the hostDescription.
        // Checkers have to be registered in code.
        'processTypes': [
                { 'processType': 'test',
                  'checkerType': 'testChecker' }
        ],
        // Hosts have many processes.  The processes have types, which are
        // described in the processDescription.  The host type is used to
        // link the description with a physical host...
        'hostTypes': [ {
                'hostType': 'test',
                'processes': [
                        { 'processType': 'test', 'id': 1 },
                        { 'processType': 'test', 'id': 2 }
                ]
        }],
        //Hosts are physical entities that are described by the
        // hostTypes.
        'hosts': [
                { 'hostType': 'test',
                  'ip': '127.0.0.1',
                  'uuid': '111-111-1111',
                  'datacenter': 'local',
                  'server': '127.0.0.1'
                }
        ]
};

var LOG = bunyan.createLogger({
        level: (process.env.LOG_LEVEL || 'debug'),
        name: 'checker',
        stream: process.stdout
});

var hc = new HealthChecker({ log: LOG });

helper.before(function (cb) {
        var configAndStart = function() {
                hc.registerFromConfig(testCfg,
                                      function () { hc.start(cb) });
        };
        hc.registerChecker({
                'label': 'testChecker',
                'checker': TestChecker }, configAndStart);

});

helper.after(function(cb) {
        hc.stop(cb);
});

test('the checks we configure execute and count up', function(t) {
        setTimeout(function () {
                t.equal(hc.checks.length, 2);
                t.ok(hc.checks[0].numChecks > 0);
                t.ok(hc.checks[1].numChecks > 0);
                t.done();
        }, 11000);
});
