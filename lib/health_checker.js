// Copyright 2020 Joyent, Inc.

var assert = require('assert-plus');
var events = require('events');
var TimeBucket = require('./time_bucket.js');
var util = require('util');
var vasync = require('vasync');


///--- Globals
var CHECK_TIMEOUT = 300000;
var DEFAULT_CHECK_PERIOD = 15000;
var HIST_PERIOD_SECONDS = 60;
var HIST_NUMBER_PERIODS = 30;



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


function status(check, deep) {
        var o = buildObject({}, check.cfg);
        deep = deep || false;
        o.stats = check.stats;
        if (deep) {
                //Don't want this in the logs, but want it separate from the
                // history.
                o.totals = check.history.healthy.totals();

                //History Summary
                o.history = {};
                o.history.lastErrTime = check.history.lastErrTime;
                o.history.periods = HIST_NUMBER_PERIODS;
                o.history.periodsSinceError = null;
                if (check.history.lastErrTime !== undefined) {
                        var now = (new Date()).getTime();
                        var delta = (now - check.history.lastErrTime) / 1000;
                        if (delta <
                            (HIST_NUMBER_PERIODS * HIST_PERIOD_SECONDS)) {
                                o.history.periodsSinceError =
                                        Math.round(delta / HIST_PERIOD_SECONDS);
                        }
                }

                //The detailed history will be factored out with
                // joyent/node-checker#8
                o.history.healthy = check.history.healthy.values();
                o.history.latency = check.history.latency.values();
        }
        return (o);
}


function performHealthCheck(check) {
        var self = this;
        if (self.stopped) {
                return;
        }
        var strt = (new Date()).getTime();
        var stats = {};

        var checkResultsCalled = false;
        var checkTimeout = false;
        var checkTimeoutId;
        function onCheckResults(err, res) {
                if (checkResultsCalled) {
                        self.log.error({
                                checkCfg: check.config,
                                err: err,
                                res: res,
                                checkTimeout: checkTimeout,
                                start: strt
                        }, 'check results called multiple times');
                        return;
                }
                clearTimeout(checkTimeoutId);

                var end = (new Date()).getTime();
                stats.lastChecked = end;
                stats.lastLatency = end - strt;
                if (err) {
                        check.history.lastErrTime = end;
                        stats.lastErr = err;
                        stats.healthy = false;
                } else {
                        stats.healthy = true;
                }
                if (res) {
                        stats = buildObject(stats, res);
                }
                check.stats = stats;
                //Adding to history buckets...
                check.history.healthy.add({
                        'value': stats.healthy,
                        'time': strt
                });
                check.history.latency.add({
                        'value': stats.lastLatency,
                        'time': strt
                });
                self.log.info(status(check), 'audit');
                check.timeoutId = setTimeout(
                        performHealthCheck.bind(self, check),
                        DEFAULT_CHECK_PERIOD);

                checkResultsCalled = true;
        }

        //Check timeout...
        checkTimeoutId = setTimeout(function () {
                checkTimeout = true;
                self.log.error({
                        start: strt,
                        checkCfg: check.config
                }, 'check never called back');
                var error = new Error('CheckTimeout');
                error.code = 'CheckTimeout';
                onCheckResults(error);
        }, CHECK_TIMEOUT);
        check.check(onCheckResults);
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
        check.history = {};
        var histOpts = {
                'periodSeconds': HIST_PERIOD_SECONDS,
                'numberPeriods': HIST_NUMBER_PERIODS,
                'log': self.log
        };
        check.history.healthy = new TimeBucket(histOpts);
        check.history.latency = new TimeBucket(histOpts);
        //TODO: Spread these out
        process.nextTick(performHealthCheck.bind(self, check));
        return (check);
}



///--- Api

HealthChecker.prototype.start = function start(cb) {
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

HealthChecker.prototype.getStats = function getStats() {
        var self = this;
        var ret = {
                orderings: {
                        hostOrder: self.hostOrder,
                        processOrder: self.processOrder
                },
                checks: []
        };
        for (var i = 0; i < self.checks.length; ++i) {
                ret.checks.push(status(self.checks[i], true));
        }
        return (ret);
};

HealthChecker.prototype.stop = function stop(cb) {
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
        assert.func(opts.checker, 'opts.checker');
        assert.func(opts.checker.prototype.check,
                    'opts.checker.prototype.check');
        assert.func(opts.checker.prototype.label,
                    'opts.checker.prototype.label');
        assert.func(cb, 'cb');

        var self = this;
        var label = opts.checker.prototype.label();
        self.checkers[label] = opts.checker;
        cb();
};

HealthChecker.prototype.registerCheckers = function registerCheckers(opts, cb) {
        assert.object(opts, 'opts');
        assert.arrayOfFunc(opts.checkers, 'opts.checkers');
        assert.func(cb, 'cb');

        var self = this;
        var i = 0;
        function registerNextChecker() {
                var checker = opts.checkers[i];

                if (checker === undefined) {
                        cb(null);
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

                self.registerChecker({ 'checker': checker }, registered);
        }
        registerNextChecker();
};

HealthChecker.prototype.registerHost = function registerHost(opts, cb) {
        assert.object(opts, 'opts');
        assert.string(opts.hostType, 'opts.hostType');
        assert.string(opts.ip, 'opts.ip');
        assert.string(opts.uuid, 'opts.uuid');
        assert.string(opts.datacenter, 'opts.datacenter');
        assert.string(opts.server, 'opts.server');
        assert.func(cb, 'cb');

        var self = this;

        if (self.hostTypes[opts.hostType]) {
                self.hosts[opts.ip] = opts;
        } else {
                self.log.warn({
                    validTypes: Object.keys(self.hostTypes)
                }, 'No host description with type "' + opts.hostType
                    + '", ignoring');
        }

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
