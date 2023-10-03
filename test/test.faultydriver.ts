import { expect } from 'chai';
import { promisifyOne, promisifyTwo } from './promisify';
import { expectError } from './utils';

mocha.setup({ asyncOnly: true });

describe('When Driver Fails to Initialize', function () {
    const FAULTYDRIVERS = [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE]
        .filter(localforage.supports)
        .filter(function (driverName) {
            // FF doesn't allow you to override `localStorage.setItem`
            // so if the faulty driver setup didn't succeed
            // then skip the localStorage tests
            return !(
                driverName === localforage.LOCALSTORAGE &&
                localStorage.setItem.toString().indexOf('[native code]') >= 0
            );
        });

    FAULTYDRIVERS.forEach(function (driverName) {
        describe(driverName, function () {
            beforeEach(function () {
                if (driverName === localforage.LOCALSTORAGE) {
                    localStorage.clear();
                }
            });

            it('fails to setDriver ' + driverName + ' [callback]', function () {
                const setDriver = promisifyTwo(localforage.setDriver, localforage);
                return setDriver(driverName).then(function () {
                    const ready = promisifyOne(localforage.ready, localforage);
                    ready().then(expectError, function (err) {
                        expect(err).to.be.instanceof(Error);
                        expect(err.message).to.be.eq('No available storage method found.');
                    });
                });
            });

            it('fails to setDriver ' + driverName + ' [promise]', function () {
                return localforage
                    .setDriver(driverName)
                    .then(function () {
                        return localforage.ready();
                    })
                    .then(expectError, function (err) {
                        expect(err).to.be.instanceof(Error);
                        expect(err.message).to.be.eq('No available storage method found.');
                    });
            });
        });
    });
});
