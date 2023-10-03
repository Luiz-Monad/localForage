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

function promisifyOne<Rest extends readonly unknown[], Success, Context>(
    func: (this: Context | undefined, ...args: [...rest: Rest, resolve: Callback<Success>]) => void,
    thisContext?: Context
): (...rest: Rest) => Promise<Success> {
    return (...rest: Rest) => {
        return new Promise<Success>((resolve, reject) => {
            try {
                const success: Callback<Success> = (_, result) => {
                    resolve(result);
                };
                func.apply(thisContext, [...rest, success]);
            } catch (err: any) {
                reject(err);
            }
        });
    };
}

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
                const setDriver = promisify(localforage.setDriver, localforage);
                return setDriver(driverName).then(function () {
                    const ready = promisifyOne(localforage.ready, localforage);
                    ready().then(null, function (err) {
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
                    .then(null, function (err) {
                        expect(err).to.be.instanceof(Error);
                        expect(err.message).to.be.eq('No available storage method found.');
                    });
            });
        });
    });
});
