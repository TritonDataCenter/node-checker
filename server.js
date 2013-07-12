// Copyright 2013 Nate Fitch, All rights reserved.

var bunyan = require('bunyan');
var getopt = require('posix-getopt');
var lib = require('./lib');
var path = require('path');



//--- Globals

var LOG = bunyan.createLogger({
        level: (process.env.LOG_LEVEL || 'info'),
        name: 'checker',
        stream: process.stdout
});



//--- Helpers

function usage(msg) {
        if (msg) {
                console.error(msg);
        }
        var str  = 'usage: ' + path.basename(process.argv[1]);
        str += ' [-c config_file]';
        str += ' [-p port]';
        console.error(str);
        process.exit(1);
}


function parseOptions() {
        var option;
        var opts = {
                'configFiles': []
        };
        var parser = new getopt.BasicParser('c:p:',
                                            process.argv);
        while ((option = parser.getopt()) !== undefined && !option.error) {
                switch (option.option) {
                case 'c':
                        opts.configFiles.push(option.optarg);
                        break;
                case 'p':
                        opts.port = parseInt(option.optarg, 10);
                        break;
                default:
                        usage('Unknown option: ' + option.option);
                        break;
                }
        }

        if (opts.configFiles.length === 0) {
                usage('No config files specified.');
        }

        return (opts);
}



//--- Main

var _opts = parseOptions();
_opts.log = LOG;

lib.createAndStartServer(_opts, function (err) {
        if (err) {
                LOG.fatal(err, 'Error starting server');
                return;
        }
        LOG.info('Server started.');
});
