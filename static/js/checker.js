// Copyright 2013 Nate Fitch, All rights reserved.

// http://learn.jquery.com/plugins/basic-plugin-creation/
(function($) {
        var REFRESH_PERIOD = 15000;

        //--- Fetch the data
        function getData(cb) {
                var self = this;
                //When it fails to GET it returns err -> 'error'.  That's
                // a terrible thing to display...
                function error(xhr, err) {
                        if (err === 'error') {
                                err = new Error('Unable to contact server.');
                        }
                        cb(err);
                }

                function success(data, status) {
                        try {
                                var d = JSON.parse(data);
                        } catch (e) {
                                cb(e);
                                return;
                        }
                        cb(null, d);
                }

                $.ajax({
                        'url': '/checker',
                        'dataType': 'text',
                        'success': success,
                        'error': error
                });
        }

        //--- Waiting...
        function enableWaiting() {
                var self = this;
                $('#waiting', self).each(function () {
                        $(this).append(self.waitingImage);
                });
        }

        function disableWaiting() {
                var self = this;
                $('#waiting', self).each(function () {
                        this.innerHTML = '';
                });
        }

        //--- Clock
        function updateClock(seconds) {
                var self = this;
                if (seconds % 5 === 0) {
                        $('#clock', self).each(function () {
                                this.innerHTML = seconds +
                                        ' seconds until refresh.';
                        });
                }
        }

        //--- Debug
        function debug() {
                var self = this;
                return (self.debug);
        }

        //--- Error
        function displayError(message) {
                var self = this;
                if (!message) {
                        message = 'Something unexpected happened...';
                }
                $('#error', self).each(function () {
                        this.innerHTML = '<font class=error>' + message +
                                '</font>';
                        //Display for 7 seconds, the hide it.
                        setTimeout(function () {
                                $('#error', self).each(function () {
                                        this.innerHTML = '';
                                });
                        }, 7000);
                });
        }

        //--- Main display

        //Process dialog content
        function processDisplay(process) {
                var self = this;
                var d = $('<div></div>');

                var t = $('<table class="process-details-table">');
                d.append(t);

                //Always Display
                function tr(c) {
                        var tr = $('<tr></tr>');
                        var td = $('<td colspan="2"></td>');
                        td.append(c);
                        tr.append(td);
                        t.append(tr);
                }


                //Healthy text here.
                var asof = '<div class="tiny-text">as of ' +
                        (new Date(process.stats.lastChecked)) +
                        '</div>';
                if (process.stats.healthy) {
                        tr('<div class="healthy-text">Healthy</div>' + asof);
                } else {
                        var text = "Unhealthy: " +
                                (process.stats.lastErr.code ||
                                 process.stats.lastErr.name ||
                                 'Unknown');
                        tr('<div class="unhealthy-text">' + text + '</div>' +
                           asof);
                }
                tr('<hr>');

                //Sparkline: Health
                var minutes =
                        (process.history.healthy[0].time -
                         process.history.healthy[1].time) *
                        process.history.healthy.length / 60 / 1000;

                tr('<div class="tiny-text">Health, over ' + minutes +
                   ' minutes:</div>');
                var hvals = process.history.healthy.map(function (v) {
                        var hc = v.values[true] || 0;
                        var fc = v.values[false] || 0;
                        return fc + ':' + hc;
                }).reverse();
                var health = $('<div></div>').sparkline(hvals, {
                        'type': 'bar',
                        'stackedBarColor': ['#FF3333', '#00FF00'],
                        'barWidth': 6,
                        'barSpacing': 2
                });
                tr(health);

                //Sparkline: Latency
                tr('<div class="tiny-text">Average Latency:</div>');
                var lvals = process.history.latency.map(function (v) {
                        if (v.count === 0) {
                                return 0;
                        }
                        //Compute average for each latency...
                        var vks = Object.keys(v.values);
                        var tot = 0;
                        for (var i = 0; i < vks.length; ++i) {
                                tot += parseInt(vks[i]) * v.values[vks[i]];
                        }
                        return (tot / v.count);
                }).reverse();
                var latency = $('<div></div>').sparkline(lvals, {
                        'type': 'line',
                        'defaultPixelsPerValue': 8
                });
                tr(latency);

                tr('<hr>');

                //Collapsible
                function pth(l) {
                        t.append('<tr class="process-details-table-header">' +
                                 '<td colspan="2">' + l + '<td></tr>');

                }
                function ptr(k, l) {
                        t.append('<tr class="process-details-table-row">' +
                                 '<td class="process-details-table-key">' +
                                 (l || k) + ':</td>' +
                                 '<td>' + process[k] + '<td></tr>');
                }
                pth('Host Details');
                ptr('uuid');
                ptr('server');
                ptr('datacenter', 'dc');

                pth('Checker Details');
                ptr('checkerType', 'type');
                ptr('ip');
                ptr('port');

                //Make sections hideable, thank you stackoverfow
                //http://stackoverflow.com/questions/16926752/expand-collapse-table-rows-with-jquery
                $('.process-details-table-header', t).click(function () {
                        $(this).nextUntil('tr.process-details-table-header').slideToggle(1);
                });

                //Hide all trs to begin
                $('.process-details-table-row', t).hide();

                return d;
        }

        //The little colored squares
        function processWidget(process) {
                var self = this;
                //Determine health
                var cssclass = process.stats.healthy ?
                        'healthy-host' : 'unhealthy-host';

                //Make it easier to see what still needs to be implemented.
                if (process.checkerType === 'noop') {
                        cssclass = 'noop-host';
                }

                var div = $('<div></div>');
                div.addClass(cssclass);

                var dg = null;
                div.click(function (eve) {
                        if (!dg) {
                                dg = $('<div class="host-popover" ' +
                                       'title="' + process.uuid + '"' +
                                       '></div>');
                                div.append(dg);
                                dg.append(processDisplay(process));
                                var pos = div.position();
                                var width = div.width();
                                var buttons = {
                                        Ok: function () {
                                                $(this).dialog('close');
                                        }
                                };
                                if (debug.call(self)) {
                                        buttons['Debug'] = function () {
                                                console.log(process);
                                        }
                                }
                                dg.dialog({
                                        dialog: true,
                                        buttons: buttons,
                                        //Good enough for now...
                                        position: [eve.clientX,
                                                   eve.clientY]
                                });
                        }
                        dg.dialog('open');
                        //Have to render the sparklines here.  See:
                        // http://omnipotent.net/jquery.sparkline/#hidden
                        $.sparkline_display_visible();
                });

                return div;
        }

        //Host and processs
        function hostWidget(processes) {
                var self = this;
                var type = processes[0].hostType;
                var ip = processes[0].ip;
                var zonePrefix = processes[0].uuid.split('-')[0];

                //Group into process groups...
                var p = {};
                for (var i = 0; i < processes.length; ++i) {
                        var pr = processes[i];
                        if (!p[pr.processType]) {
                                p[pr.processType] = [];
                        }
                        p[pr.processType].push(pr);
                }

                var table = $('<table class="host-table">');
                table.append('<tr><th>' + zonePrefix + '</th></tr>');

                //Process groups
                var pts = self.currentData.orderings.processOrder[type];
                for (var i = 0; i < pts.length; ++i) {
                        var pt = p[pts[i]];
                        var row = $('<tr>');
                        var td = $('<td>');
                        var nobr = $('<nobr>');
                        nobr.append(pt[0].processType + ': ');
                        for (var j = 0; j < pt.length; ++j) {
                                var pc = pt[j];
                                nobr.append(processWidget.call(self, pc));
                        }
                        td.append(nobr);
                        row.append(td);
                        table.append(row);
                }

                return table;
        }

        //The big table
        function displayData() {
                var self = this;
                var data = self.currentData.checks;

                //Organize all checks into hostType/datacenter/ip
                var d = {};
                var dcs = [];
                for (var i = 0; i < data.length; ++i) {
                        var td = data[i];
                        if (dcs.indexOf(td.datacenter) === -1) {
                                dcs.push(td.datacenter);
                        }
                        if (!d[td.hostType]) {
                                d[td.hostType] = {};
                        }
                        if (!d[td.hostType][td.datacenter]) {
                                d[td.hostType][td.datacenter] = {};
                        }
                        if (!d[td.hostType][td.datacenter][td.ip]) {
                                d[td.hostType][td.datacenter][td.ip] = [];
                        }
                        d[td.hostType][td.datacenter][td.ip].push(td);
                }

                dcs.sort();

                //Headers...
                var table = $('<table class="arch-table"><tr>');
                var row = $('<tr>');
                row.append('<th class="arch-table-th-header">' +
                           '<nobr>Host Type<nobr></th>');
                for (var i = 0; i < dcs.length; ++i) {
                        row.append('<th class="arch-table-th-td">' +
                                   dcs[i] + '</th>');
                }
                table.append(row);

                //Now create a new widget for each...
                var hostTypes = self.currentData.orderings.hostOrder;
                for (var i = 0; i < hostTypes.length; ++i) {
                        var t = hostTypes[i];
                        //Means no hosts, so don't display the row...
                        if (!d[t]) {
                                continue;
                        }

                        row = $('<tr>');
                        row.append('<td>' + t + '</td>');
                        for (var j = 0; j < dcs.length; ++j) {
                                var dc = dcs[j];
                                var td = $('<td>');
                                var hs = Object.keys(d[t][dc] || {});
                                for (var k = 0; k < hs.length; ++k) {
                                        var h = hs[k];
                                        var hostW = hostWidget.call(self,
                                                                 d[t][dc][h]);
                                        td.append(hostW);
                                }
                                row.append(td);
                        }
                        table.append(row);
                }

                //Finish it up...
                $('#waiting', self).each(function () {
                        this.innerHTML = '';
                });

                $('#hosts', self).each(function () {
                        this.innerHTML = '';
                        $(this).append(table);
                });

        }

        //--- Refresh
        function refresh(cb) {
                var self = this;
                enableWaiting.call(self);
                getData.call(self, function (err, data) {
                        disableWaiting.call(self);
                        if (err) {
                                displayError.call(self, err.message);
                                cb();
                                return;
                        }
                        self.currentData = data;
                        displayData.call(self);
                        cb();
                });
        }

        function scheduleRefresh() {
                var self = this;

                var seconds = REFRESH_PERIOD / 1000;
                //Cheating here...
                var secondsSinceUpdate = seconds;
                function tryRefresh() {
                        ++secondsSinceUpdate;
                        if (secondsSinceUpdate < seconds) {
                                updateClock.call(self,
                                                 seconds - secondsSinceUpdate);
                                setTimeout(tryRefresh, 1000);
                                return;
                        }
                        refresh.call(self, function () {
                                secondsSinceUpdate = 0;
                                updateClock.call(self, seconds);
                                setTimeout(tryRefresh, 1000);
                        });
                }
                tryRefresh();
        }

        //--- "Main"
        $.fn.checker = function() {
                return this.filter('div').each(function() {
                        var self = this;
                        //Set up the bare-necessities, an outer shell...
                        $(self).append('<div id="status">' +
                                         '<table class="status-table"><tr>' +
                                           '<td class="status-left">' +
                                             '<div id="waiting"></div>' +
                                             '<div id="error"></div>' +
                                           '</td>' +
                                           '<td class="status-right">' +
                                             '<div id="clock">' +
                                           '</td>' +
                                         '</table>' +
                                       '</div>')
                                .append('<div id="hosts"></div>');
                        self.waitingImage = $('<img class="waiting" src="css/images/ui-anim_basic_16x16.gif"/>');
                        var dls = document.location.search;
                        self.debug = (dls.indexOf('debug') !== -1);
                        scheduleRefresh.call(self);
                });
        };
}(jQuery));
