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

describe('Driver API', function () {
    beforeEach(function () {
        if (localforage.supports(localforage.INDEXEDDB)) {
            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(localforage.INDEXEDDB);
        } else if (localforage.supports(localforage.WEBSQL)) {
            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(localforage.WEBSQL);
        }
        return Promise.resolve();
    });

    if (
        (localforage.supports(localforage.INDEXEDDB) &&
            localforage.driver() === localforage.INDEXEDDB) ||
        (localforage.supports(localforage.WEBSQL) && localforage.driver() === localforage.WEBSQL)
    ) {
        it('can change to localStorage from ' + localforage.driver() + ' [callback]', function () {
            const previousDriver = localforage.driver();

            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(localforage.LOCALSTORAGE).then(function () {
                expect(localforage.driver()).to.be.eq(localforage.LOCALSTORAGE);
                expect(localforage.driver()).to.not.be.eq(previousDriver);
            });
        });
        it('can change to localStorage from ' + localforage.driver() + ' [promise]', function () {
            const previousDriver = localforage.driver();

            return localforage.setDriver(localforage.LOCALSTORAGE).then(function () {
                expect(localforage.driver()).to.be.eq(localforage.LOCALSTORAGE);
                expect(localforage.driver()).to.not.be.eq(previousDriver);
            });
        });
    }

    if (!localforage.supports(localforage.INDEXEDDB)) {
        it("can't use unsupported IndexedDB [callback]", function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.not.be.eq(localforage.INDEXEDDB);

            // These should be rejected in component builds but aren't.
            // TODO: Look into why.
            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(localforage.INDEXEDDB).then(function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
        it("can't use unsupported IndexedDB [promise]", function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.not.be.eq(localforage.INDEXEDDB);

            // These should be rejected in component builds but aren't.
            // TODO: Look into why.
            return localforage.setDriver(localforage.INDEXEDDB).then(null, function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
    } else {
        it('can set already active IndexedDB [callback]', function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.be.eq(localforage.INDEXEDDB);

            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(localforage.INDEXEDDB).then(function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
        it('can set already active IndexedDB [promise]', function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.be.eq(localforage.INDEXEDDB);

            return localforage.setDriver(localforage.INDEXEDDB).then(function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
    }

    if (!localforage.supports(localforage.LOCALSTORAGE)) {
        it("can't use unsupported localStorage [callback]", function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.not.be.eq(localforage.LOCALSTORAGE);

            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(localforage.LOCALSTORAGE).then(function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
        it("can't use unsupported localStorage [promise]", function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.not.be.eq(localforage.LOCALSTORAGE);

            return localforage.setDriver(localforage.LOCALSTORAGE).then(null, function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
    } else if (
        !localforage.supports(localforage.INDEXEDDB) &&
        !localforage.supports(localforage.WEBSQL)
    ) {
        it('can set already active localStorage [callback]', function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.be.eq(localforage.LOCALSTORAGE);

            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(localforage.LOCALSTORAGE).then(function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
        it('can set already active localStorage [promise]', function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.be.eq(localforage.LOCALSTORAGE);

            return localforage.setDriver(localforage.LOCALSTORAGE).then(function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
    }

    if (!localforage.supports(localforage.WEBSQL)) {
        it("can't use unsupported WebSQL [callback]", function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.not.be.eq(localforage.WEBSQL);

            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(localforage.WEBSQL).then(function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
        it("can't use unsupported WebSQL [promise]", function () {
            const previousDriver = localforage.driver();
            expect(previousDriver).to.not.be.eq(localforage.WEBSQL);

            return localforage.setDriver(localforage.WEBSQL).then(null, function () {
                expect(localforage.driver()).to.be.eq(previousDriver);
            });
        });
    } else {
        it('can set already active WebSQL [callback]', function () {
            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(localforage.WEBSQL).then(function () {
                const previousDriver = localforage.driver();
                expect(previousDriver).to.be.eq(localforage.WEBSQL);

                const setDriver = promisify(localforage.setDriver, localforage);
                return setDriver(localforage.WEBSQL).then(function () {
                    expect(localforage.driver()).to.be.eq(previousDriver);
                });
            });
        });
        it('can set already active WebSQL [promise]', function () {
            return localforage.setDriver(localforage.WEBSQL).then(function () {
                const previousDriver = localforage.driver();
                expect(previousDriver).to.be.eq(localforage.WEBSQL);

                return localforage.setDriver(localforage.WEBSQL).then(function () {
                    expect(localforage.driver()).to.be.eq(previousDriver);
                });
            });
        });
    }
});
