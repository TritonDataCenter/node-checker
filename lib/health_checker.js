// Copyright (c) 2013, Nate Fitch. All rights reserved.

var assert = require('assert-plus');
var events = require('events');
var util = require('util');
var vasync = require('vasync');


///--- Globals
var DEFAULT_CHECK_PERIOD = 15000;



///--- Health Checker

function HealthChecker(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.log, 'opts.log');

        var self = this;
        self.log = opts.log;
        self.stopped = true;
        self.checkers = {};
        self.hostTypes = {};
        self.processTypes = {};
        self.hosts = {};
        self.checks = [];

        //Keep the order around so the architecture can be recreated.
        self.hostOrder = [];
        self.processOrder = {};

        //TODO: Autoregister checkers in ./checkers
}

util.inherits(HealthChecker, events.EventEmitter);
module.exports = HealthChecker;



///--- Helpers

/**
 * Given a set of objects as arguments, merge in all properties of
 * objects 1..N into object 0.  Note this doesn't do a deep copy, but works
 * for the purposes we need it for.  Note that if there are members that
 * exist in all object, the first one to be set "wins".  In other words,
 * first come, first served.
 */
function buildObject() {
        assert.object(arguments[0]);
        var obj = arguments[0];
        for (var i = 1; i < arguments.length; ++i) {
                var keys = Object.keys(arguments[i]);
                for (var j = 0; j < keys.length; ++j) {
                        if (obj[keys[j]] === undefined) {
                                obj[keys[j]] = arguments[i][keys[j]];
                        }
                }
        }
        return (obj);
}


function status(check) {
        var o = buildObject({}, check.cfg);
        o.stats = check.stats;
        return (o);
}


// TODO: Sliding window of results and latency
function performHealthCheck(check) {
        var self = this;
        if (self.stopped) {
                return;
        }
        var start = (new Date()).getTime();
        var stats = {};
        check.check(function (err, res) {
                var end = (new Date()).getTime();
                stats.lastChecked = end;
                stats.lastLatency = end - start;
                if (err) {
                        stats.lastErr = err;
                        stats.healthy = false;
                } else {
                        stats.healthy = true;
                }
                if (res) {
                        stats = buildObject(stats, res);
                }
                check.stats = stats;
                self.log.info(status(check), 'audit');
                check.timeoutId = setTimeout(
                        performHealthCheck.bind(self, check),
                        DEFAULT_CHECK_PERIOD);
        });
}


function buildAndScheduleCheck(cfg) {
        var self = this;
        var checkerProto = self.checkers[cfg.checkerType];
        var check = new checkerProto({
                config: cfg,
                log: self.log
        });
        check.cfg = cfg;
        check.stats = {};
        //TODO: Spread these out
        process.nextTick(performHealthCheck.bind(self, check));
        return (check);
}



///--- Api

HealthChecker.prototype.start = function (cb) {
        var self = this;
        if (!self.stopped) {
                cb();
                return;
        }
        self.stopped = false;
        var hostIds = Object.keys(self.hosts);
        for (var i = 0; i < hostIds.length; ++i) {
                var host = self.hosts[hostIds[i]];
                var processes = self.hostTypes[host.hostType];
                for (var j = 0; j < processes.length; ++j) {
                        var proc = processes[j];
                        var procType =
                                self.processTypes[proc.processType];
                        // Merge objects for complete config, all host params
                        // override proc params, which override proc
                        // descriptions.
                        var cfg = buildObject({}, host, proc, procType);
                        self.checks.push(buildAndScheduleCheck.call(
                                self, cfg));
                }
        }
        cb();
};

HealthChecker.prototype.getStats = function () {
        var self = this;
        var ret = {
                orderings: {
                        hostOrder: self.hostOrder,
                        processOrder: self.processOrder
                },
                checks: []
        };
        for (var i = 0; i < self.checks.length; ++i) {
                ret.checks.push(status(self.checks[i]));
        }
        return (ret);
};

HealthChecker.prototype.stop = function (cb) {
        assert.func(cb, 'cb');
        var self = this;

        self.log.info('Stopping health checker');

        for (var i = 0; i < self.checks.length; ++i) {
                var check = self.checks[i];
                self.log.info({ cfg: check.cfg }, 'stopping checker');
                clearTimeout(check.timeoutId);
        }

        self.stopped = true;
        cb();
};

HealthChecker.prototype.registerChecker = function register(opts, cb) {
        assert.object(opts, 'opts');
        assert.string(opts.label, 'opts.label');
        assert.func(opts.checker, 'opts.checker');
        assert.func(opts.checker.prototype.check,
                    'opts.checker.prototype.check');
        assert.func(cb, 'cb');

        var self = this;
        self.checkers[opts.label] = opts.checker;
        cb();
};

HealthChecker.prototype.registerHost = function (opts, cb) {
        assert.object(opts, 'opts');
        assert.string(opts.hostType, 'opts.hostType');
        assert.string(opts.ip, 'opts.ip');
        assert.string(opts.uuid, 'opts.uuid');
        assert.string(opts.datacenter, 'opts.datacenter');
        assert.string(opts.server, 'opts.server');

        var self = this;
        if (!self.hostTypes[opts.hostType]) {
                var types = Object.keys(self.hostTypes);
                cb(new Error('No host description with type ' +
                             opts.hostType + ', available types: ' +
                             JSON.stringify(types)));
                return;
        }

        self.hosts[opts.ip] = opts;

        assert.func(cb, 'cb');

        cb();
};

HealthChecker.prototype.registerHostType = function registerHostType(opts, cb) {
        assert.object(opts, 'opts');
        assert.string(opts.hostType, 'opts.hostType');
        assert.arrayOfObject(opts.processes, 'opts.processes');
        assert.func(cb, 'cb');

        var self = this;

        var processOrder = [];
        for (var i = 0; i < opts.processes.length; ++i) {
                var type = opts.processes[i].processType;
                if (!self.processTypes[type]) {
                        cb(new Error('No registered process named ' + type));
                        return;
                }
                if (processOrder.indexOf(type) === -1) {
                        processOrder.push(type);
                }
        }
        self.hostTypes[opts.hostType] = opts.processes;
        if (self.hostOrder.indexOf(opts.hostType) === -1) {
                self.hostOrder.push(opts.hostType);
                self.processOrder[opts.hostType] = processOrder;
        }
        cb();
};

HealthChecker.prototype.registerProcessType = function registerProcType(opts,
                                                                        cb) {
        assert.object(opts, 'opts');
        assert.string(opts.processType, 'opts.processType');
        assert.string(opts.checkerType, 'opts.checkerType');
        assert.func(cb, 'cb');

        var self = this;

        if (!self.checkers[opts.checkerType]) {
                cb(new Error('unknown checker type ' + opts.checkerType));
                return;
        }

        self.processTypes[opts.processType] = opts;
        cb();
};

HealthChecker.prototype.registerFromConfig = function registerFromConfig(cfg,
                                                                         cb) {
        assert.object(cfg, 'cfg');
        assert.func(cb, 'cb');

        var self = this;

        function registerAllHosts(subcb) {
                if (!cfg.hosts) {
                        subcb();
                        return;
                }
                vasync.forEachParallel({
                        'func': self.registerHost.bind(self),
                        'inputs': cfg.hosts
                }, function (err) {
                        subcb(err);
                });
        }

        function registerAllHostTypes(subcb) {
                if (!cfg.hostTypes) {
                        registerAllHosts(subcb);
                        return;
                }
                vasync.forEachParallel({
                        'func': self.registerHostType.bind(self),
                        'inputs': cfg.hostTypes
                }, function (err) {
                        if (err) {
                                subcb(err);
                                return;
                        }
                        registerAllHosts(subcb);
                });
        }

        function registerAllProcessTypes(subcb) {
                if (!cfg.processTypes) {
                        registerAllHostTypes(subcb);
                        return;
                }
                vasync.forEachParallel({
                        'func': self.registerProcessType.bind(self),
                        'inputs': cfg.processTypes
                }, function (err) {
                        if (err) {
                                subcb(err);
                                return;
                        }
                        registerAllHostTypes(subcb);
                });
        }

        registerAllProcessTypes(function (err) {
                cb(err);
        });
};
