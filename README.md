node-checker
============

## Node Checker

Node Checker is a small component to aid in determining whether the components
in a distributed system are up and responsive.  It consists of a small server
that periodically health checks components and a webapp that displays status.
Node checker focuses on monitoring process responsiveness and giving a concise
view of the system.

## Spinnnig up the test server

Run:

    export CHECKER_CONFIG_FILE=./etc/checker-test.json && \
    export CHECKER_HOSTS_FILE=./etc/checker-test-hosts.json && \
    node ./server.js | bunyan

Then point your browser to:

    http://localhost:8080

You should see one single process `checker-test`.  Click on the green square
and see what the process has been doing.

## License

The MIT License (MIT)
Copyright (c) Nate Fitch

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Bugs

See <https://github.com/nfitch/node-checker/issues>.
