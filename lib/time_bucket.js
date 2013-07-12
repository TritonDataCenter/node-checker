// Copyright 2013 Nate Fitch, All rights reserved.

var assert = require('assert-plus');



///--- Time Bucket

function TimeBucket(opts) {
        assert.object(opts, 'opts');
        assert.object(opts.log, 'opts.log');
        assert.number(opts.periodSeconds, 'opts.periodSeconds');
        assert.number(opts.numberPeriods, 'opts.numberPeriods');

        var self = this;
        self.log = opts.log;
        self.period = opts.periodSeconds * 1000;
        self.numberPeriods = opts.numberPeriods;
        self.duration = self.period * self.numberPeriods;
        self.buckets = {};
}

module.exports = TimeBucket;


///--- Helpers

function purgeBuckets(now, earliestBucket) {
        var self = this;
        var keys = Object.keys(self.buckets).sort();
        while (keys[0] <= earliestBucket) {
                delete self.buckets[keys[0]];
                keys.shift();
        }
}



///--- API

TimeBucket.prototype.add = function (opts) {
        assert.object(opts, 'opts');
        assert.ok(opts.value !== null, 'opts.value');
        assert.optionalNumber(opts.time, 'opts.time');

        var self = this;
        var now = (new Date()).getTime();
        var time = opts.time || now;
        var value = opts.value;
        var earliestBucket = (now - self.duration - (now % self.period));

        var bucket = time - (time % self.period);
        if (bucket <= now &&
            bucket >= earliestBucket) {
                if (!self.buckets[bucket]) {
                        self.buckets[bucket] = {
                                'count': 0,
                                'values': {}
                        };
                }
                if (!self.buckets[bucket]['values'][value]) {
                        self.buckets[bucket]['values'][value] = 0;
                }
                ++self.buckets[bucket]['count'];
                ++self.buckets[bucket]['values'][value];
        }

        purgeBuckets.call(self, now, earliestBucket);
};


TimeBucket.prototype.values = function (opts) {
        if (opts) {
                assert.optionalBool(opts.includeAll, 'opts.includeAll');
        }

        var self = this;
        var now = (new Date()).getTime();
        var currBucket = (now - (now % self.period));
        var earliestBucket = (now - self.duration - (now % self.period));

        var includeAll = true;
        if (opts && opts.includeAll === false) {
                includeAll = false;
        }

        purgeBuckets.call(self, now, earliestBucket);

        if (!includeAll) {
                return (self.buckets);
        }

        var ret = [];
        var dummyObj = {
                'count': 0,
                'values': {}
        };
        do {
                var currObj = self.buckets[currBucket] || dummyObj;
                ret.push({
                        'time': currBucket,
                        'count': currObj['count'],
                        'values': currObj['values'] || {}
                });
                currBucket -= self.period;
        } while (currBucket > earliestBucket);
        return (ret);
};
