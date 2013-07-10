// Copyright (c) 2013, Nate Fitch. All rights reserved.

var http = require('http');

var s = http.createServer(function (req, res) {
        res.end('Ok.');
});

s.listen(8090);
