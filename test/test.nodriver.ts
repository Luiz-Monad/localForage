import { expect } from 'chai';

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
        return localforage.ready(function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq('No available storage method found.');
        });
    });

    it('fails to load localForage [promise]', function () {
        return localforage.ready().then(null, function (err) {
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
            return localforage
                .setDriver(driverName, null!, function (err) {
                    expect(err).to.be.instanceof(Error);
                    expect(err.message).to.be.eq('No available storage method found.');
                })
                .then(null, () => {});
        });

        it('fails to setDriver ' + driverName + ' [promise]', function () {
            return localforage.setDriver(driverName).then(null, function (err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.be.eq('No available storage method found.');
            });
        });
    });

    it('fails to setDriver using array parameter [callback]', function () {
        return localforage
            .setDriver(DRIVERS, null!, function (err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.be.eq('No available storage method found.');
            })
            .then(null, () => {});
    });

    it('fails to setDriver using array parameter [promise]', function () {
        return localforage.setDriver(DRIVERS).then(null, function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq('No available storage method found.');
        });
    });
});
