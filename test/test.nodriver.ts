import { expect } from 'chai';
import { Callback } from 'types';

mocha.setup({ asyncOnly: true });

function promisify<Rest extends readonly unknown[], Success, Fail, Context>(
    func: (
        this: Context | undefined,
        ...args: [...rest: Rest, resolve: Callback<Success>, reject: Callback<Fail>]
    ) => void,
    thisContext?: Context
): (...rest: Rest) => Promise<Success> {
    return (...rest: Rest) => {
        return new Promise<Success>((resolve, reject) => {
            try {
                const success: Callback<Success> = (result) => {
                    resolve(result);
                };
                const fail: Callback<Fail> = (err) => {
                    reject(err);
                };
                func.apply(thisContext, [...rest, success, fail]);
            } catch (err: any) {
                reject(err);
            }
        });
    };
}

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
            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(driverName).then(null, function (err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.be.eq('No available storage method found.');
            });
        });

        it('fails to setDriver ' + driverName + ' [promise]', function () {
            return localforage.setDriver(driverName).then(null, function (err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.be.eq('No available storage method found.');
            });
        });
    });

    it('fails to setDriver using array parameter [callback]', function () {
        const setDriver = promisify(localforage.setDriver, localforage);
        return setDriver(DRIVERS).then(null, function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq('No available storage method found.');
        });
    });

    it('fails to setDriver using array parameter [promise]', function () {
        return localforage.setDriver(DRIVERS).then(null, function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq('No available storage method found.');
        });
    });
});
