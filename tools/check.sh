#!/bin/bash
###############################################################################
# Copyright 2013 Joyent, Inc, All rights reserved.
# Runs javascriptlint and jsstyle
###############################################################################

set -o pipefail
set -o xtrace

cd deps/javascriptlint && make install && cd -

JSL=deps/javascriptlint/build/install/jsl
JSSTYLE=deps/jsstyle/jsstyle
JS_FILES=$(echo $(ls *.js && find lib test -name '*.js') | tr '\n' ' ')

$JSL --nologo --nosummary --conf=./tools/jsl.node.conf $JS_FILES
if [[ $? != 0 ]]; then
    exit 1
fi

$JSSTYLE -f tools/jsstyle.conf $JS_FILES
if [[ $? != 0 ]]; then
    exit 1
fi
