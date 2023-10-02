import { expect } from 'chai';

mocha.setup({ asyncOnly: true });

const DRIVERS = [localforage.INDEXEDDB, localforage.LOCALSTORAGE, localforage.WEBSQL];

DRIVERS.forEach(function (driverName) {
    if (
        (!Modernizr.indexeddb && driverName === localforage.INDEXEDDB) ||
        (!Modernizr.localstorage && driverName === localforage.LOCALSTORAGE) ||
        (!Modernizr.websqldatabase && driverName === localforage.WEBSQL)
    ) {
        // Browser doesn't support this storage library, so we exit the API
        // tests.
        return;
    }

    describe('Service Worker support in ' + driverName, function () {
        // Use this until a test is added to Modernizr
        if (!('serviceworker' in Modernizr)) {
            Modernizr.serviceworker = 'serviceWorker' in navigator;
        }

        if (!Modernizr.serviceworker) {
            before.skip("doesn't have service worker support");
            beforeEach.skip("doesn't have service worker support");
            it.skip("doesn't have service worker support");
            after.skip("doesn't have service worker support");
            return;
        }

        if (!window.MessageChannel) {
            before.skip("doesn't have MessageChannel support");
            beforeEach.skip("doesn't have MessageChannel support");
            it.skip("doesn't have MessageChannel support");
            after.skip("doesn't have MessageChannel support");
            return;
        }

        before(function () {
            return navigator.serviceWorker
                .register('/test/serviceworker-client.js')
                .then(function () {
                    return localforage.setDriver(driverName);
                });
        });

        after(function () {
            return navigator.serviceWorker.ready.then(function (registration) {
                return registration.unregister();
            });
        });

        beforeEach(function () {
            return new Promise((resolve) => localforage.clear(resolve));
        });

        if (driverName === localforage.LOCALSTORAGE || driverName === localforage.WEBSQL) {
            it.skip(driverName + ' is not supported in service workers');
            return;
        }

        xit('should set a value on registration', function () {
            return navigator.serviceWorker.ready
                .then(function () {
                    return localforage.getItem('service worker registration');
                })
                .then(function (result) {
                    expect(result).to.equal('serviceworker present');
                });
        });

        it('saves data', function () {
            return new Promise<void>(function (resolve, reject) {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = function (event) {
                    expect(event.data.body).to.be.eq('I have been set using ' + driverName);
                    resolve();
                };

                navigator.serviceWorker.ready
                    .then(function (registration) {
                        registration?.active?.postMessage(
                            {
                                driver: driverName,
                                value: 'I have been set'
                            },
                            [messageChannel.port2]
                        );
                    })
                    .then(resolve)
                    .catch(reject);
            });
        });
    });
});
