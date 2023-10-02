import { expect } from 'chai';
import dummyStorageDriver from './dummyStorageDriver';

mocha.setup({ asyncOnly: true });

describe('When Custom Drivers are used', function () {
    const errorMessage =
        'Custom driver not compliant; see ' + 'https://mozilla.github.io/localForage/#definedriver';

    it('fails to define a no-name custom driver', function () {
        return localforage
            .defineDriver(
                {
                    _initStorage: () => {},
                    iterate: () => {},
                    getItem: () => {},
                    setItem: () => {},
                    removeItem: () => {},
                    clear: () => {},
                    length: () => {},
                    key: () => {},
                    keys: () => {}
                } as any,
                null!,
                function (err) {
                    expect(err).to.be.instanceof(Error);
                    expect(err.message).to.be.eq(errorMessage);
                }
            )
            .then(null, () => {});
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

    it('fails to define a custom driver with missing methods', function () {
        return localforage
            .defineDriver(
                {
                    _driver: 'missingMethodsDriver',
                    _initStorage: () => {},
                    iterate: () => {},
                    getItem: () => {},
                    setItem: () => {},
                    removeItem: () => {},
                    clear: () => {}
                } as any,
                null!,
                function (err) {
                    expect(err).to.be.instanceof(Error);
                    expect(err.message).to.be.eq(errorMessage);
                }
            )
            .then(null, () => {});
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

    it('defines a compliant custom driver', function () {
        return localforage.defineDriver(dummyStorageDriver, function () {});
    });

    it('defines a compliant custom driver [promise]', function () {
        return localforage.defineDriver(dummyStorageDriver).then(function () {});
    });

    it('sets a custom driver', function () {
        return localforage.defineDriver(dummyStorageDriver, function () {
            return localforage.setDriver(dummyStorageDriver._driver, function () {
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

    it('sets and uses a custom driver', function () {
        return localforage.defineDriver(dummyStorageDriver, function () {
            return localforage.setDriver(dummyStorageDriver._driver, function (err) {
                expect(err).to.be.eq(undefined);
                return localforage.setItem('testCallbackKey', 'testCallbackValue', function (err) {
                    expect(err).to.be.eq(null);
                    return localforage.getItem('testCallbackKey', function (err, value) {
                        expect(err).to.be.eq(null);
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
