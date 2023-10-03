import { expect } from 'chai';
import { Callback } from 'types';
import dummyStorageDriver from './dummyStorageDriver';

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

describe('When Custom Drivers are used', function () {
    const errorMessage =
        'Custom driver not compliant; see ' + 'https://mozilla.github.io/localForage/#definedriver';

    it('fails to define a no-name custom driver [callback]', function () {
        const defineDriver = promisify(localforage.defineDriver, localforage);
        return defineDriver({
            _initStorage: () => {},
            iterate: () => {},
            getItem: () => {},
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
            length: () => {},
            key: () => {},
            keys: () => {}
        } as any).then(null!, function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq(errorMessage);
        });
    });

    it('fails to define a no-name custom driver [promise]', function () {
        return localforage
            .defineDriver({
                _driver: '',
                _initStorage: () => Promise.reject(),
                iterate: () => Promise.reject(),
                getItem: () => Promise.reject(),
                setItem: () => Promise.reject(),
                removeItem: () => Promise.reject(),
                clear: () => Promise.reject(),
                length: () => Promise.reject(),
                key: () => Promise.reject(),
                keys: () => Promise.reject()
            })
            .then(null, function (err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.be.eq(errorMessage);
            });
    });

    it('fails to define a custom driver with missing methods [callback]', function () {
        const defineDriver = promisify(localforage.defineDriver, localforage);
        return defineDriver({
            _driver: 'missingMethodsDriver',
            _initStorage: () => {},
            iterate: () => {},
            getItem: () => {},
            setItem: () => {},
            removeItem: () => {},
            clear: () => {}
        } as any).then(null, function (err) {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.be.eq(errorMessage);
        });
    });

    it('fails to define a custom driver with missing methods [promise]', function () {
        return localforage
            .defineDriver({
                _driver: 'missingMethodsDriver',
                _initStorage: () => Promise.reject(),
                iterate: () => Promise.reject(),
                getItem: () => Promise.reject(),
                setItem: () => Promise.reject(),
                removeItem: () => Promise.reject(),
                clear: () => Promise.reject()
            } as any)
            .then(null, function (err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.be.eq(errorMessage);
            });
    });

    it('defines a compliant custom driver [callback]', function () {
        return promisify(localforage.defineDriver, localforage);
    });

    it('defines a compliant custom driver [promise]', function () {
        return localforage.defineDriver(dummyStorageDriver);
    });

    it('sets a custom driver [callback]', function () {
        const defineDriver = promisify(localforage.defineDriver, localforage);
        return defineDriver(dummyStorageDriver).then(function () {
            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(dummyStorageDriver._driver).then(function () {
                expect(localforage.driver()).to.be.eq(dummyStorageDriver._driver);
            });
        });
    });

    it('sets a custom driver [promise]', function () {
        return localforage
            .defineDriver(dummyStorageDriver)
            .then(function () {
                return localforage.setDriver(dummyStorageDriver._driver);
            })
            .then(function () {
                expect(localforage.driver()).to.be.eq(dummyStorageDriver._driver);
            });
    });

    it("defines a driver synchronously when it doesn't have _supports()", function () {
        const customDriver = {
            _driver: 'dummyStorageDriver' + +new Date(),
            _initStorage: () => {},
            // _support: function() { return true; }
            iterate: () => {},
            getItem: () => {},
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
            length: () => {},
            key: () => {},
            keys: () => {}
        } as any;

        localforage.defineDriver(customDriver);
        return localforage.setDriver(customDriver._driver).then(function () {
            expect(localforage.driver()).to.be.eq(customDriver._driver);
        });
    });

    it('defines a driver synchronously when it has boolean _supports()', function () {
        const customDriver = {
            _driver: 'dummyStorageDriver' + +new Date(),
            _initStorage: () => {},
            _support: true,
            iterate: () => {},
            getItem: () => {},
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
            length: () => {},
            key: () => {},
            keys: () => {}
        } as any;

        localforage.defineDriver(customDriver);
        return localforage.setDriver(customDriver._driver).then(function () {
            expect(localforage.driver()).to.be.eq(customDriver._driver);
        });
    });

    it('defines a driver asynchronously when _supports() returns a Promise<boolean>', function () {
        const customDriver = {
            _driver: 'dummyStorageDriver' + +new Date(),
            _initStorage: () => {},
            _support: () => Promise.resolve(true),
            iterate: () => {},
            getItem: () => {},
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
            length: () => {},
            key: () => {},
            keys: () => {}
        } as any;

        return localforage
            .defineDriver(customDriver)
            .then(function () {
                return localforage.setDriver(customDriver._driver);
            })
            .then(function () {
                expect(localforage.driver()).to.be.eq(customDriver._driver);
            });
    });

    it('sets and uses a custom driver [callback]', function () {
        const defineDriver = promisify(localforage.defineDriver, localforage);
        return defineDriver(dummyStorageDriver).then(function () {
            const setDriver = promisify(localforage.setDriver, localforage);
            return setDriver(dummyStorageDriver._driver).then(function () {
                const setItem = promisifyOne(localforage.setItem, localforage);
                return setItem('testCallbackKey', 'testCallbackValue').then(function () {
                    const getItem = promisifyOne(localforage.getItem, localforage);
                    return getItem('testCallbackKey').then(function (value) {
                        expect(value).to.be.eq('testCallbackValue');
                    });
                });
            });
        });
    });

    it('sets and uses a custom driver [promise]', function () {
        return localforage
            .defineDriver(dummyStorageDriver)
            .then(function () {
                return localforage.setDriver(dummyStorageDriver._driver);
            })
            .then(function () {
                return localforage.setItem('testPromiseKey', 'testPromiseValue');
            })
            .then(function () {
                return localforage.getItem('testPromiseKey');
            })
            .then(function (value) {
                expect(value).to.be.eq('testPromiseValue');
            });
    });

    describe('when dropInstance is not defined', function () {
        it('rejects when it is used', function () {
            const customDriver = {
                _driver: 'dummyStorageDriver' + +new Date(),
                _initStorage: () => {},
                _support: () => Promise.resolve(true),
                iterate: () => {},
                getItem: () => {},
                setItem: () => {},
                removeItem: () => {},
                clear: () => {},
                length: () => {},
                key: () => {},
                keys: () => {}
            } as any;

            return localforage
                .defineDriver(customDriver)
                .then(function () {
                    return localforage.setDriver(customDriver._driver);
                })
                .then(function () {
                    return localforage.dropInstance!();
                })
                .catch(function (err) {
                    expect(err.message).to.be.eq(
                        'Method dropInstance is not implemented by the current driver'
                    );
                });
        });
    });

    describe('when dropInstance is defined', function () {
        it('is does not reject', function () {
            const customDriver = {
                _driver: 'dummyStorageDriver' + +new Date(),
                _initStorage: () => {},
                _support: () => Promise.resolve(true),
                iterate: () => {},
                getItem: () => {},
                setItem: () => {},
                removeItem: () => {},
                clear: () => {},
                length: () => {},
                key: () => {},
                keys: () => {},
                dropInstance: () => {}
            } as any;

            return localforage
                .defineDriver(customDriver)
                .then(function () {
                    return localforage.setDriver(customDriver._driver);
                })
                .then(function () {
                    return localforage.dropInstance!();
                });
        });
    });
});
