import { expect } from 'chai';

describe('Config API', function () {
    'use strict';

    var DRIVERS = [localforage.INDEXEDDB, localforage.LOCALSTORAGE, localforage.WEBSQL];
    var supportedDrivers: string[] = [];

    before(function () {
        this.defaultConfig = localforage.config();

        supportedDrivers = [];
        for (var i = 0; i <= DRIVERS.length; i++) {
            if (localforage.supports(DRIVERS[i])) {
                supportedDrivers.push(DRIVERS[i]);
            }
        }
    });

    // Reset localForage before each test so we can call `config()` without
    // errors.
    beforeEach(function () {
        (localforage as any)._ready = null;
        localforage.config(this.defaultConfig);
    });

    it('returns the default values', function (done) {
        expect(localforage.config('description')).to.be.eq('');
        expect(localforage.config('name')).to.be.eq('localforage');
        expect(localforage.config('size')).to.be.eq(4980736);
        expect(localforage.config('storeName')).to.be.eq('keyvaluepairs');
        expect(localforage.config('version')).to.be.eq(1.0);
        localforage.ready(function () {
            expect(localforage.config('driver')).to.be.eq(localforage.driver());
            done();
        });
    });

    it('returns error if API call was already made', function (done) {
        localforage.length(function () {
            var configResult = localforage.config({
                description: '123',
                driver: 'I a not set driver',
                name: 'My Cool App',
                storeName: 'myStoreName',
                version: 2.0
            })!;

            var error = "Error: Can't call config() after localforage " + 'has been used.';

            expect(configResult).to.not.be.eq(true);
            expect(configResult.toString()).to.be.eq(error);

            // Expect the config values to be as they were before.
            expect(localforage.config('description')).to.not.be.eq('123');
            expect(localforage.config('description')).to.be.eq('');
            expect(localforage.config('driver')).to.be.eq(localforage.driver());
            expect(localforage.config('driver')).to.not.be.eq('I a not set driver');
            expect(localforage.config('name')).to.be.eq('localforage');
            expect(localforage.config('name')).to.not.be.eq('My Cool App');
            expect(localforage.config('size')).to.be.eq(4980736);
            expect(localforage.config('storeName')).to.be.eq('keyvaluepairs');
            expect(localforage.config('version')).to.be.eq(1.0);

            done();
        });
    });

    it('sets new values and returns them properly', function (done) {
        var secondSupportedDriver = supportedDrivers.length >= 2 ? supportedDrivers[1] : null;

        localforage.config({
            description: 'The offline datastore for my cool app',
            driver: secondSupportedDriver,
            name: 'My Cool App',
            storeName: 'myStoreName',
            version: 2.0
        });

        expect(localforage.config('description')).to.not.be.eq('');
        expect(localforage.config('description')).to.be.eq('The offline datastore for my cool app');
        expect(localforage.config('driver')).to.be.eq(secondSupportedDriver);
        expect(localforage.config('name')).to.be.eq('My Cool App');
        expect(localforage.config('size')).to.be.eq(4980736);
        expect(localforage.config('storeName')).to.be.eq('myStoreName');
        expect(localforage.config('version')).to.be.eq(2.0);

        localforage.ready(function () {
            if (supportedDrivers.length >= 2) {
                expect(localforage.config('driver')).to.be.eq(secondSupportedDriver);
            } else {
                expect(localforage.config('driver')).to.be.eq(supportedDrivers[0]);
            }
            done();
        });
    });

    if (supportedDrivers.length >= 2) {
        it('sets new driver using preference order', function (done) {
            var otherSupportedDrivers = supportedDrivers.slice(1);

            var configResult = localforage.config({
                driver: otherSupportedDrivers
            });

            expect(configResult).to.be.a(Promise);
            localforage
                .ready(function () {
                    expect(localforage.config('driver')).to.be.eq(otherSupportedDrivers[0]);
                    return configResult;
                })
                .then(function () {
                    done();
                });
        });
    }

    it('it does not set an unsupported driver', function (done) {
        var oldDriver = localforage.driver();
        var configResult = localforage.config({
            driver: 'I am a not supported driver'
        });

        expect(configResult).to.be.a(Promise);
        localforage
            .ready(function () {
                expect(localforage.config('driver')).to.be.eq(oldDriver);
                return configResult;
            })
            .catch(function (error) {
                expect(error).to.be.instanceof(Error);
                expect(error.message).to.be.eq('No available storage method found.');
                done();
            });
    });

    it('it does not set an unsupported driver using preference order', function (done) {
        var oldDriver = localforage.driver();
        localforage.config({
            driver: ['I am a not supported driver', 'I am a an other not supported driver']
        });

        localforage.ready(function () {
            expect(localforage.config('driver')).to.be.eq(oldDriver);
            done();
        });
    });

    it('converts bad config values across drivers', function () {
        localforage.config({
            name: 'My Cool App',
            // https://github.com/mozilla/localForage/issues/247
            storeName: 'my store&name-v1',
            version: 2.0
        });

        expect(localforage.config('name')).to.be.eq('My Cool App');
        expect(localforage.config('storeName')).to.be.eq('my_store_name_v1');
        expect(localforage.config('version')).to.be.eq(2.0);
    });

    it('uses the config values in ' + localforage.driver(), function (done) {
        localforage.config({
            description: 'The offline datastore for my cool app',
            driver: localforage.driver(),
            name: 'My Cool App',
            storeName: 'myStoreName',
            version: 2.0
        });

        localforage.setItem('some key', 'some value').then(function (value) {
            if (localforage.driver() === localforage.INDEXEDDB) {
                const indexedDB =
                    global.indexedDB ||
                    window.indexedDB ||
                    window.webkitIndexedDB ||
                    window.mozIndexedDB ||
                    window.OIndexedDB ||
                    window.msIndexedDB;
                var req = indexedDB.open('My Cool App', 2.0);

                req.onsuccess = function () {
                    var dbValue = req.result
                        .transaction('myStoreName', 'readonly')
                        .objectStore('myStoreName')
                        .get('some key');
                    expect(dbValue).to.be.eq(value);
                    done();
                };
            } else if (localforage.driver() === localforage.WEBSQL) {
                window
                    .openDatabase('My Cool App', String(2.0), '', 4980736)
                    .transaction(function (t) {
                        t.executeSql(
                            'SELECT * FROM myStoreName WHERE key = ? ' + 'LIMIT 1',
                            ['some key'],
                            function (t, results) {
                                var dbValue = JSON.parse(results.rows.item(0).value);

                                expect(dbValue).to.be.eq(value);
                                done();
                            }
                        );
                    });
            } else if (localforage.driver() === localforage.LOCALSTORAGE) {
                var dbValue = JSON.parse(localStorage['My Cool App/myStoreName/some key']);

                expect(dbValue).to.be.eq(value);
                done();
            }
        });
    });

    it("returns all values when config isn't passed arguments", function () {
        expect(localforage.config()).to.be.an('object');
        expect(Object.keys(localforage.config()!).length).to.be.eq(6);
    });

    // This may go away when https://github.com/mozilla/localForage/issues/168
    // is fixed.
    it('maintains config values across setDriver calls', function (done) {
        localforage.config({
            name: 'Mega Mozilla Dino'
        });

        localforage
            .length()
            .then(function () {
                return localforage.setDriver(localforage.LOCALSTORAGE);
            })
            .then(function () {
                expect(localforage.config('name')).to.be.eq('Mega Mozilla Dino');
                done();
            });
    });

    it('returns error if database version is not a number', function (done) {
        var configResult = localforage.config({
            version: 2.0
        })!;

        var error = 'Error: Database version must be a number.';

        expect(configResult).to.not.be.eq(true);
        expect(configResult.toString()).to.be.eq(error);
        done();
    });
});
