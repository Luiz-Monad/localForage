import { expect } from 'chai';
import { promisifyOne, promisifyTwo } from './promisify';
import { expectError } from './utils';

mocha.setup({ asyncOnly: true });

describe('When No Drivers Are Available', function () {
    const DRIVERS = [localforage.INDEXEDDB, localforage.LOCALSTORAGE, localforage.WEBSQL];

    xit('agrees with Modernizr on storage drivers support', async function () {
        /* Used version of Modernizr doesn't support dissabling INDEXEDDB */
        expect(localforage.supports(localforage.INDEXEDDB)).to.be.eq(false);

        expect(localforage.supports(localforage.LOCALSTORAGE)).to.be.eq(false);
        expect(localforage.supports(localforage.LOCALSTORAGE)).to.be.eq(Modernizr.localstorage);

        expect(localforage.supports(localforage.WEBSQL)).to.be.eq(false);
        expect(localforage.supports(localforage.WEBSQL)).to.be.eq(Modernizr.websqldatabase);
    });

    it('fails to load localForage [callback]', function () {
        const ready = promisifyOne(localforage.ready, localforage);
        return ready().then(expectError, function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq('No available storage method found.');
        });
    });

    it('fails to load localForage [promise]', function () {
        return localforage.ready().then(expectError, function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq('No available storage method found.');
        });
    });

    it('has no driver set', function () {
        return localforage.ready(function () {
            expect(localforage.driver()).to.be.eq(null);
        });
    });

    DRIVERS.forEach(function (driverName) {
        it('fails to setDriver ' + driverName + ' [callback]', function () {
            const setDriver = promisifyTwo(localforage.setDriver, localforage);
            return setDriver(driverName).then(expectError, function (err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.be.eq('No available storage method found.');
            });
        });

        it('fails to setDriver ' + driverName + ' [promise]', function () {
            return localforage.setDriver(driverName).then(expectError, function (err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.be.eq('No available storage method found.');
            });
        });
    });

    it('fails to setDriver using array parameter [callback]', function () {
        const setDriver = promisifyTwo(localforage.setDriver, localforage);
        return setDriver(DRIVERS).then(expectError, function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq('No available storage method found.');
        });
    });

    it('fails to setDriver using array parameter [promise]', function () {
        return localforage.setDriver(DRIVERS).then(expectError, function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq('No available storage method found.');
        });
    });
});
