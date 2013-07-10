// Copyright (c) 2013, Nate Fitch. All rights reserved.

var bunyan = require('bunyan');
var helper = require('./helper.js');
var HealthChecker = require('../lib/health_checker');
var vasync = require('vasync');



///--- Globals

//TODO: Make this an actual test...
//var test = helper.test;



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
        return 'testChecker';
}


///--- Tests

var testCfg = {
        //Processes are monitored a certain way.  In this case, the "test"
        // process has its health checked by the "test checker".  The process
        // type is what links this to processes in the hostDescription.
        //Checkers have to be registered in code.
        'processTypes': [
                { 'processType': 'test',
                  'checkerType': 'testChecker' }
        ],
        //Hosts have many processes.  The processes have types, which are
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
vasync.pipeline({
        'funcs': [
                function initHc(_, subcb) {
                        hc.registerChecker({
                                'label': 'testChecker',
                                'checker': TestChecker
                        }, function (err) {
                                subcb(err);
                        });
                },
                function registerConfig(_, subcb) {
                        hc.registerFromConfig(testCfg, subcb);
                },
                function start(_, subcb) {
                        hc.start(subcb);
                },
                function pause(_, subcb) {
                        setTimeout(subcb, 11000);
                },
                function stop(_, subcb) {
                        LOG.info({ stats: hc.getStats() }, 'final stats');
                        hc.stop(subcb);
                }
        ]
}, function (err) {
        if (err) {
                LOG.error(err);
                process.exit(1);
        }
});
