'use strict';

const STATS_TYPE_PLAYLIST = 'playlist';
const STATS_TYPE_CHUNKLIST = 'chunklist';
const STATS_TYPE_CHUNK = 'chunk';

class StatsItem {
    constructor(statsType, startTime, url) {
        this.statsType = statsType;
        this.startTime = startTime;
        this.url = url;

        this.timeout = false;
        this.error = false;
        this.statusCode = 0;
        this.size = 0;
        this.responseTime = 0;
    }

    update(xhr) {
        this.statusCode = xhr.status;
        if (xhr.response && xhr.response.length)
            this.size = xhr.response.length;

        let endTime = (new Date()).getTime();
        this.responseTime = endTime - this.startTime;
        if (this.responseTime < 0)
            this.responseTime = 0;
    }
}

class Stats {
    constructor() {
        // array of StatsItem
        this.statsItems = [];

        // event
        this.onchanged = null;
    }

    clearStatsItems() {
        this.statsItems = [];
        if (this.onchanged) {
            this.onchanged();
        }
    }

    addStats(item) {
        this.statsItems.push(item);
        while (this.statsItems.length > 100000) {
            this.statsItems.shift();
        }

        if (this.onchanged) {
            this.onchanged(item.statsType);
        }
    }

    getTypedStatsItems(statsType, cond) {
        if (!statsType && !cond)
            return this.statsItems;
        return this.statsItems.filter(item => (!statsType || item.statsType == statsType) && (!cond || cond(item)));
    }

    getTimeoutStatsItems(statsType) {
        return this.getTypedStatsItems(statsType, item => item.timeout);
    }

    getErrorStatsItems(statsType) {
        return this.getTypedStatsItems(statsType, item => item.error);
    }

    lastStatsItem(statsType) {
        let typedStatsItems = this.getTypedStatsItems(statsType);
        return typedStatsItems.length > 0 ? typedStatsItems[typedStatsItems.length - 1] : null;
    }

    lastURL(statsType) {
        let typedStatsItems = this.getTypedStatsItems(statsType);
        return typedStatsItems.length > 0 ? typedStatsItems[typedStatsItems.length - 1].url : '';
    }

    lastTimeoutStatsItem(statsType) {
        let timeoutItems = this.getTimeoutStatsItems(statsType);
        return timeoutItems.length > 0 ? timeoutItems[timeoutItems.length - 1] : null;
    }

    lastTimeoutURL(statsType) {
        let timeoutItems = this.getTimeoutStatsItems(statsType);
        return timeoutItems.length > 0 ? timeoutItems[timeoutItems.length - 1].url : '';
    }

    lastErrorStatsItem(statsType) {
        let errorItems = this.getErrorStatsItems(statsType);
        return errorItems.length > 0 ? errorItems[errorItems.length - 1] : null;
    }

    lastErrorURL(statsType) {
        let errorItems = this.getErrorStatsItems(statsType);
        return errorItems.length > 0 ? errorItems[errorItems.length - 1].url : '';
    }

    getStatusCodeHistogram(statsType) {
        let typedStatsItems = this.getTypedStatsItems(statsType);

        let statusCodes = {};

        typedStatsItems.forEach(item => {
            let key = '' + item.statusCode; // convert to string
            if (statusCodes[key]) {
                statusCodes[key]++;
            } else {
                statusCodes[key] = 1;
            }
        });

        let getSequential = function (cond) {
            let count = 0;
            let sequential = 0;
            let curSequential = 0;

            typedStatsItems.forEach(item => {
                count += (cond && cond(item)) ? 1 : 0;
                curSequential = (cond && cond(item)) ? curSequential + 1 : 0;
                if (sequential < curSequential)
                    sequential = curSequential;
            });

            return [count, sequential];
        }

        let [timeout, sequentialTimeout] = getSequential(item => item.timeout);
        let [error, sequentialError] = getSequential(item => item.error);

        if (timeout > 0) {
            statusCodes['Timeout'] = timeout;
            statusCodes['Sequential Timeout'] = sequentialTimeout;
        }
        if (error > 0) {
            statusCodes['Error'] = error;
            statusCodes['Sequential Error'] = sequentialError;
        }

        return statusCodes;
    }

    getResponseTimeHisto(statsType) {
        let responseTimes = this.getResponseTimes(statsType);
        if (responseTimes.length <= 0) {
            return [];
        }

        let ranges = [10, 100, 500, 1000, 2500, 5000, 10000];
        let responseTimeHisto = [
            { key: "< 10ms", value: 0 },
            { key: "10ms - 100ms", value: 0 },
            { key: "100ms - 500ms", value: 0 },
            { key: "500ms - 1s", value: 0 },
            { key: "1s - 2.5s", value: 0 },
            { key: "2.5s - 5s", value: 0 },
            { key: "5s - 10s", value: 0 },
            { key: "> 10s", value: 0 },
        ];

        responseTimes.forEach(value => {
            for (let i = 0; i < ranges.length; i++) {
                if (value < ranges[i]) {
                    responseTimeHisto[i].value++;
                    return;
                }
            }
            // last
            responseTimeHisto[responseTimeHisto.length - 1].count++;
        })

        if (true) {
            responseTimeHisto.push({ key: 'Last (ms)', value: Stats.responseTimeLast(responseTimes) });
            responseTimeHisto.push({ key: 'Min (ms)', value: Stats.responseTimeMin(responseTimes) });
            responseTimeHisto.push({ key: 'Max (ms)', value: Stats.responseTimeMax(responseTimes) });
            responseTimeHisto.push({ key: 'Avg (ms)', value: Stats.responseTimeAvg(responseTimes) });
            responseTimeHisto.push({ key: 'Avg (Last 10) (ms)', value: Stats.responseTimeAvgLast10(responseTimes) });
            responseTimeHisto.push({ key: 'Avg (Last 100) (ms)', value: Stats.responseTimeAvgLast100(responseTimes) });
        }

        return responseTimeHisto;
    }

    getStatusCodes(statsType) {
        let typedStatsItems = this.getTypedStatsItems(statsType);
        let statusCodes = typedStatsItems.map(item => item.statusCode);
        return statusCodes;
    }

    getResponseTimes(statsType) {
        let typedStatsItems = this.getTypedStatsItems(statsType);
        let responseTimes = typedStatsItems.map(item => item.responseTime);
        return responseTimes;
    }

    static responseTimeLast(responseTimes) {
        if (responseTimes.length <= 0)
            return 0;
        return responseTimes[responseTimes.length - 1];
    }
    static responseTimeMin(responseTimes) {
        if (responseTimes.length <= 0)
            return 0;
        return Math.min.apply(Math, responseTimes);
    }
    static responseTimeMax(responseTimes) {
        if (responseTimes.length <= 0)
            return 0;
        return Math.max.apply(Math, responseTimes);
    }
    static responseTimeAvg(responseTimes) {
        if (responseTimes.length <= 0)
            return 0;
        let sum = responseTimes.reduce((total, cur) => total + cur, 0);
        return Math.floor(sum / responseTimes.length);
    }
    static responseTimeAvgLast10(responseTimes) {
        if (responseTimes.length <= 0)
            return 0;
        let last10 = responseTimes.slice(-10);
        let sum = last10.reduce((total, cur) => total + cur, 0);
        return Math.floor(sum / last10.length);
    }
    static responseTimeAvgLast100(responseTimes) {
        if (responseTimes.length <= 0)
            return 0;
        let last100 = responseTimes.slice(-100);
        let sum = last100.reduce((total, cur) => total + cur, 0);
        return Math.floor(sum / last100.length);
    }
}

var statsManager = {
    streamUrl: '',
    startTime: 0,
    lastStartTime: 0,
    ipAddress: '',
    userAgent: '',
    reportTemplate: '',

    stats: new Stats(),
    timeout: 30000,
    playing: false,
    lastChunk: void 0, // undefined
};


function requestStream(statsType, url, callback) {
    let startTime = (new Date()).getTime();
    let statsItem = new StatsItem(statsType, startTime, url);

    let xhr = new XMLHttpRequest();
    /*xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            statsItem.update(xhr);
            statsManager.stats.addStats(statsItem);                    
        }
    };*/
    xhr.ontimeout = function (evt) {
        statsItem.timeout = true;
    }
    xhr.onerror = function () {
        statsItem.error = true;
    }
    xhr.onloadend = function (evt) {
        statsItem.update(xhr);
        statsManager.stats.addStats(statsItem);

        if (callback) {
            callback(xhr);
        }
    }

    xhr.open("GET", url, true);
    xhr.timeout = statsManager.timeout;
    xhr.send();
}

function requestChunk(url) {
    requestStream(STATS_TYPE_CHUNK, url, function (xhr) {

    });
}

function requestChunklist(url) {
    requestStream(STATS_TYPE_CHUNKLIST, url, function (xhr) {
        if (xhr.status >= 200 && xhr.status < 400) {
            let chunks = [];

            let myRegexp = /#EXTINF.*\r?\n(.*)/g;
            let m = myRegexp.exec(xhr.responseText);
            while (m) {
                if (m[1] && m[1].indexOf("#") == -1) { // not empty and not starts with #
                    chunks.push(m[1]);
                }
                m = myRegexp.exec(xhr.responseText);
            }

            if (chunks.length > 0) {
                let lastChunkIndex = chunks.indexOf(statsManager.lastChunk);

                let playingChunk;
                if (lastChunkIndex >= 0 && lastChunkIndex < chunks.length - 1) {
                    playingChunk = chunks[lastChunkIndex + 1];
                } else {
                    playingChunk = chunks[chunks.length - 1];
                }

                if (playingChunk != statsManager.lastChunk) {
                    statsManager.lastChunk = playingChunk;

                    let pos = url.lastIndexOf("/");
                    let chunkUrl = url.substring(0, pos + 1) + statsManager.lastChunk;
                    if (statsManager.playing) {
                        requestChunk(chunkUrl);
                    }
                }
            }
        }

        if (statsManager.playing) {
            setTimeout(requestChunklist, 8000, url);
        }
    });
}

function requestPlaylist(url) {
    requestStream(STATS_TYPE_PLAYLIST, url, function (xhr) {
        let hasChunklist = false;
        if (xhr.status >= 200 && xhr.status < 400) {
            let myRegexp = /#EXT-X-STREAM-INF.*\r?\n(.*)/;
            let m = myRegexp.exec(xhr.responseText);
            if (m && m[1]) {
                let pos = url.lastIndexOf("/");
                let chunklistUrl = (pos > 0 ? url.substring(0, pos + 1) + m[1] : m[1]);
                if (statsManager.playing) {
                    requestChunklist(chunklistUrl);
                }
                hasChunklist = true;
            }
        }

        if (statsManager.playing && !hasChunklist) {
            setTimeout(requestPlaylist, 10000, url);
        }
    });
}
