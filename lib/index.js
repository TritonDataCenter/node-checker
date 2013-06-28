// Copyright (c) 2013, Nate Fitch. All rights reserved.

var HealthChecker = require('./health_checker');



///--- API

module.exports = {
        createHealthChecker: function createHealthChecker(opts) {
                var ab = new HealthChecker(opts);
                return (ab);
        }
};
