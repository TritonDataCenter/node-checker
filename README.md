node-checker
============

## Node Checker

Node Checker is a small component to aid in determining whether the components
in a distributed system are up and responsive.  It consists of a class that
periodically health checks components and a webapp that displays status.  Node
checker focuses on monitoring process responsiveness and giving a concise view
of the system.

Note that the server included can be used for simple deployments, but works off
static config files.  For more complicated deployment scenarios, it is expected
that the consumer of node-checker will implement a system for dynamically adding
and removing hosts from the health checker.

## Spinning up the test server

Run:

    node ./server.js -c ./etc/checker-test.json \
       -c ./etc/checker-test-hosts.json | bunyan

Then point your browser to:

    http://localhost:8080

You should see one `host` called `uuid` and two squares next to a processes
called `checker-test`.  Click on the green square and see details about the
process, including the port and the health checker type.  Also notice the
historical healthiness and latency for the health checks.  Click on the red
square and notice that the error is `ECONNREFUSED` (or something like that).
Enable the ping server:

    node ./test/ping_server.js

After a refresh or two, the square will turn green, meaning the process is up
and healthy.  Click on the square to see the historical trends.  For all of you
that need some eye-candy before you try it:

![node-checker-screenshot](https://raw.github.com/joyent/node-checker/master/docs/node-checker-screenshot.png)

## License

The MIT License (MIT)
Copyright (c) Joyent, Inc.

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

See <https://github.com/joyent/node-checker/issues>.
