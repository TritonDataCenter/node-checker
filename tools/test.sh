#!/bin/bash
###############################################################################
# Copyright 2013 Joyent, Inc, All rights reserved.
# Runs javascriptlint and jsstyle
###############################################################################

set -o pipefail
set -o xtrace

find test/ -name '*.test.js' | xargs -n 1 ./node_modules/nodeunit/bin/nodeunit
