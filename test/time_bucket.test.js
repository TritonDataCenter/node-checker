// Copyright (c) 2013, Nate Fitch. All rights reserved.

var bunyan = require('bunyan');
var helper = require('./helper.js');
var TimeBucket = require('../lib/time_bucket');
var vasync = require('vasync');



///--- Globals

var test = helper.test;
var LOG = bunyan.createLogger({
        level: (process.env.LOG_LEVEL || 'debug'),
        name: 'checker',
        stream: process.stdout
});

///--- Objects



///--- Tests

test('simple bucket', function (t) {
        var periods = 8;
        var periodSeconds = 60;
        var opts = {
                'periodSeconds': periodSeconds,
                'numberPeriods': periods,
                'log': LOG
        };
        var tb = new TimeBucket(opts);

        //Add a couple
        var now = (new Date()).getTime();
        tb.add({ 'value': 1, 'time': now - periodSeconds * 1000 * 6 });
        tb.add({ 'value': 1, 'time': now - periodSeconds * 1000 * 1 });
        tb.add({ 'value': 2, 'time': now - periodSeconds * 1000 * 1 });
        tb.add({ 'value': 1, 'time': now - periodSeconds * 1000 * 1 });
        tb.add({ 'value': 1, 'time': now });

        var values = tb.values();
        t.equal(periods, values.length);
        t.deepEqual({ '1': 1 }, values[0].values);
        t.deepEqual({ '1': 2, '2': 1 }, values[1].values);
        t.deepEqual({}, values[2].values);
        t.deepEqual({}, values[3].values);
        t.deepEqual({}, values[4].values);
        t.deepEqual({}, values[5].values);
        t.deepEqual({ '1': 1 }, values[6].values);
        t.deepEqual({}, values[7].values);

        //Check our counts are right.
        t.equal(1, values[0].count);
        t.equal(3, values[1].count);
        t.equal(0, values[2].count);
        t.equal(0, values[3].count);
        t.equal(0, values[4].count);
        t.equal(0, values[5].count);
        t.equal(1, values[6].count);
        t.equal(0, values[7].count);

        //Check our totals...
        var totals = tb.totals();
        t.equal(5, totals.count);
        t.deepEqual({ '1': 4, '2': 1 }, totals.values);

        t.done();
});

test('simple bucket, bools', function (t) {
        var periods = 8;
        var periodSeconds = 60;
        var opts = {
                'periodSeconds': periodSeconds,
                'numberPeriods': periods,
                'log': LOG
        };
        var tb = new TimeBucket(opts);

        //Add a couple
        var now = (new Date()).getTime();
        tb.add({ 'value': true, 'time': now - periodSeconds * 1000 * 6 });
        tb.add({ 'value': true, 'time': now - periodSeconds * 1000 * 1 });
        tb.add({ 'value': true, 'time': now - periodSeconds * 1000 * 1 });
        tb.add({ 'value': false, 'time': now - periodSeconds * 1000 * 1 });
        tb.add({ 'value': false, 'time': now });

        var values = tb.values();
        t.equal(periods, values.length);
        t.deepEqual({ false: 1 }, values[0].values);
        t.deepEqual({ true: 2, false: 1 }, values[1].values);
        t.deepEqual({}, values[2].values);
        t.deepEqual({}, values[3].values);
        t.deepEqual({}, values[4].values);
        t.deepEqual({}, values[5].values);
        t.deepEqual({ true: 1 }, values[6].values);
        t.deepEqual({}, values[7].values);

        //Check our totals...
        var totals = tb.totals();
        t.equal(5, totals.count);
        t.deepEqual({ true: 3, false: 2 }, totals.values);

        t.done();
});

test('add outside time period', function (t) {
        var periods = 2;
        var periodSeconds = 60;
        var opts = {
                'periodSeconds': periodSeconds,
                'numberPeriods': periods,
                'log': LOG
        };
        var tb = new TimeBucket(opts);

        //Add a couple
        var now = (new Date()).getTime();
        tb.add({ 'value': 1, 'time': now - periodSeconds * 1000 * 2 });
        tb.add({ 'value': 1, 'time': now });

        var values = tb.values();
        t.equal(periods, values.length);
        t.deepEqual({ '1': 1 }, values[0].values);
        t.deepEqual({ }, values[1].values);

        //Check our totals...
        var totals = tb.totals();
        t.equal(1, totals.count);
        t.deepEqual({ '1': 1 }, totals.values);

        t.done();
});

test('period roll over', function (t) {
        var periods = 2;
        var periodSeconds = 2;
        var opts = {
                'periodSeconds': periodSeconds,
                'numberPeriods': periods,
                'log': LOG
        };
        var tb = new TimeBucket(opts);

        //Add one for each period
        var now = (new Date()).getTime();
        tb.add({ 'value': 1, 'time': now });
        tb.add({ 'value': 2, 'time': now - periodSeconds * 1000 });

        var values = tb.values();
        t.equal(periods, values.length);
        t.deepEqual({ '1': 1 }, values[0].values);
        t.deepEqual({ '2': 1 }, values[1].values);

        //Check our totals...
        var totals = tb.totals();
        t.equal(2, totals.count);
        t.deepEqual({ '1': 1, '2': 1 }, totals.values);

        setTimeout(function () {
                values = tb.values();
                t.equal(periods, values.length);
                t.deepEqual({ }, values[0].values);
                t.deepEqual({ '1': 1 }, values[1].values);

                //Verify that that bucket was purged...
                values = tb.values({ 'includeAll': false });
                t.equal(1, Object.keys(values).length);

                //Verify that our totals are correct...
                totals = tb.totals();
                t.equal(1, totals.count);
                t.deepEqual({ '1': 1 }, totals.values);

                t.done();
        }, periodSeconds * 1000);
});
