import { expect } from 'chai';

mocha.setup({ asyncOnly: true });

const DRIVERS = [localforage.INDEXEDDB, localforage.LOCALSTORAGE, localforage.WEBSQL];

DRIVERS.forEach(function (driverName) {
    if (
        (!localforage.supports(localforage.INDEXEDDB) && driverName === localforage.INDEXEDDB) ||
        (!localforage.supports(localforage.LOCALSTORAGE) &&
            driverName === localforage.LOCALSTORAGE) ||
        (!localforage.supports(localforage.WEBSQL) && driverName === localforage.WEBSQL)
    ) {
        // Browser doesn't support this storage library, so we exit the API
        // tests.
        return;
    }

    describe('Web Worker support in ' + driverName, function () {
        'use strict';

        before(function () {
            return localforage.setDriver(driverName);
        });

        beforeEach(function () {
            return new Promise((resolve) => localforage.clear(resolve));
        });

        if (!Modernizr.webworkers) {
            it.skip("doesn't have web worker support");
            return;
        }

        if (driverName === localforage.LOCALSTORAGE || driverName === localforage.WEBSQL) {
            it.skip(driverName + ' is not supported in web workers');
            return;
        }

        it('saves data', function () {
            return new Promise<void>(function (resolve) {
                const webWorker = new Worker('/test/webworker-client.js');

                webWorker.addEventListener('message', function (e) {
                    const body = e.data.body;

                    window.console.log(body);
                    expect(body).to.be.eq('I have been set');
                    resolve();
                });

                webWorker.addEventListener('error', function (e) {
                    window.console.log(e);
                });

                webWorker.postMessage({
                    driver: driverName,
                    value: 'I have been set'
                });
            });
        });
    });
});
