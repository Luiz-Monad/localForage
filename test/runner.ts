// Run before window.onload to make sure the specs have access to describe()
// and other mocha methods. All feels very hacky though :-/
import 'mocha';
mocha.setup('bdd');

interface Title {
    title: string;
    parent: Title;
}

function runTestSuit() {
    var runner = mocha.run();

    var failedTests: any[] = [];

    runner.on('end', function () {
        window.mochaResults = runner.stats;
        window.mochaResults.reports = failedTests;
    });

    function flattenTitles(test: Title) {
        var titles = [];

        while (test.parent.title) {
            titles.push(test.parent.title);
            test = test.parent;
        }

        return titles.reverse();
    }

    function logFailure(test: Title, err: Error) {
        failedTests.push({
            name: test.title,
            result: false,
            message: err.message,
            stack: err.stack,
            titles: flattenTitles(test)
        });
    }

    runner.on('fail', logFailure);
}

if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (callback, thisArg) {
        if (typeof callback !== 'function') {
            throw new TypeError(callback + ' is not a function!');
        }
        var len = this.length;
        for (var i = 0; i < len; i++) {
            callback.call(thisArg, this[i], i, this);
        }
    };
}

declare var requirejs: any;

var require: any = global.require;
if (require) {
    requirejs.config({
        paths: {
            localforage: '/dist/localforage'
        }
    });
    require(['localforage'], function (localforage: LocalForageDriver) {
        window.localforage = localforage;

        require([
            'test.api',
            'test.config',
            'test.datatypes',
            'test.drivers',
            'test.iframes',
            'test.webworkers',
            'test.serviceworkers'
        ], runTestSuit);
    });
} else if (window.addEventListener) {
    window.addEventListener('load', runTestSuit);
} else if (window.attachEvent) {
    window.attachEvent('onload', runTestSuit);
}
