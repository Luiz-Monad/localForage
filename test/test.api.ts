import { expect } from 'chai';

mocha.setup({ asyncOnly: true });

const DRIVERS = [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE];

const SUPPORTED_DRIVERS = DRIVERS.filter(function (driverName) {
    return localforage.supports(driverName);
});

const driverApiMethods = ['getItem', 'setItem', 'clear', 'length', 'removeItem', 'key', 'keys'];

const indexedDB =
    // eslint-disable-next-line no-use-before-define
    global.indexedDB ||
    window.indexedDB ||
    window.webkitIndexedDB ||
    window.mozIndexedDB ||
    window.OIndexedDB ||
    window.msIndexedDB;

describe('localForage API', function () {
    // https://github.com/mozilla/localForage#working-on-localforage
    it('has Promises available', async function () {
        expect(Promise).to.be.a('function');
    });
});

describe('localForage', function () {
    const appropriateDriver =
        (localforage.supports(localforage.INDEXEDDB) && localforage.INDEXEDDB) ||
        (localforage.supports(localforage.WEBSQL) && localforage.WEBSQL) ||
        (localforage.supports(localforage.LOCALSTORAGE) && localforage.LOCALSTORAGE);

    it(
        'automatically selects the most appropriate driver (' + appropriateDriver + ')',
        function () {
            this.timeout(10000);
            return localforage.ready().then(
                function () {
                    if (window.requireTest) {
                        const appropriateDriver1 =
                            (localforage.supports(localforage.WEBSQL) && localforage.WEBSQL) ||
                            (localforage.supports(localforage.LOCALSTORAGE) &&
                                localforage.LOCALSTORAGE);
                        expect(localforage.driver()).to.be.eq(appropriateDriver1);
                    } else {
                        expect(localforage.driver()).to.be.eq(appropriateDriver);
                    }
                },
                function (error) {
                    expect(error).to.be.instanceof(Error);
                    expect(error.message).to.be.eq('No available storage method found.');
                    expect(localforage.driver()).to.be.eq(null);
                }
            );
        }
    );

    it('errors when a requested driver is not found [callback]', function () {
        return localforage
            .getDriver('UnknownDriver', null!, function (error) {
                expect(error).to.be.instanceof(Error);
                expect(error.message).to.be.eq('Driver not found.');
            })
            .then(null, () => {});
    });

    it('errors when a requested driver is not found [promise]', function () {
        return localforage.getDriver('UnknownDriver').then(null, function (error) {
            expect(error).to.be.instanceof(Error);
            expect(error.message).to.be.eq('Driver not found.');
        });
    });

    it('retrieves the serializer [callback]', function () {
        return localforage.getSerializer(function (serializer) {
            expect(serializer).to.be.an('object');
        });
    });

    it('retrieves the serializer [promise]', function () {
        const serializerPromise = localforage.getSerializer();
        expect(serializerPromise).to.be.instanceOf(Promise);
        expect(serializerPromise.then).to.be.instanceOf(Function);

        return serializerPromise.then(function (serializer) {
            expect(serializer).to.be.an('object');
        });
    });

    it('does not support object parameter to setDriver', function () {
        const driverPreferedOrder = {
            '0': localforage.INDEXEDDB,
            '1': localforage.WEBSQL,
            '2': localforage.LOCALSTORAGE,
            length: 3
        } as any as string[];

        return localforage.setDriver(driverPreferedOrder).then(null, function (error) {
            expect(error).to.be.instanceof(Error);
            expect(error.message).to.be.eq('No available storage method found.');
        });
    });

    it('skips drivers that fail to initilize', function () {
        const failingStorageDriver = (function () {
            function driverDummyMethod() {
                return Promise.reject(new Error('Driver Method Failed.'));
            }

            return {
                _driver: 'failingStorageDriver',
                _initStorage: function _initStorage() {
                    return Promise.reject(new Error('Driver Failed to Initialize.'));
                },
                iterate: driverDummyMethod,
                getItem: driverDummyMethod,
                setItem: driverDummyMethod,
                removeItem: driverDummyMethod,
                clear: driverDummyMethod,
                length: driverDummyMethod,
                key: driverDummyMethod,
                keys: driverDummyMethod
            };
        })();

        const driverPreferedOrder = [
            failingStorageDriver._driver,
            localforage.INDEXEDDB,
            localforage.WEBSQL,
            localforage.LOCALSTORAGE
        ];

        return localforage
            .defineDriver(failingStorageDriver)
            .then(function () {
                return localforage.setDriver(driverPreferedOrder);
            })
            .then(function () {
                return localforage.ready();
            })
            .then(function () {
                expect(localforage.driver()).to.be.eq(appropriateDriver);
            });
    });

    describe('createInstance()', function () {
        let oldConsoleInfo: typeof console.info;

        before(function () {
            oldConsoleInfo = console.info;
            const logs: typeof console.infoLogs = [];
            console.info = function () {
                console.infoLogs.push({
                    args: arguments as any
                });
                oldConsoleInfo.apply(this, arguments as any);
            };
            console.infoLogs = logs;
        });

        after(function () {
            console.info = oldConsoleInfo;
        });

        it('does not log unnecessary messages', function () {
            const oldLogCount = console.infoLogs.length;
            const localforage2 = localforage.createInstance();
            const localforage3 = localforage.createInstance();

            return Promise.all([
                localforage.ready(),
                localforage2.ready(),
                localforage3.ready()
            ]).then(function () {
                expect(console.infoLogs.length).to.be.eq(oldLogCount);
            });
        });
    });
});

const require: any = global.require;

SUPPORTED_DRIVERS.forEach(function (driverName) {
    if (require && 'asyncStorage' === driverName) {
        console.warn('asyncStorage with requirejs not working well');
        return;
    }
    describe(driverName + ' driver', function () {
        this.timeout(30000);

        before(function () {
            return localforage.setDriver(driverName);
        });

        beforeEach(function () {
            localStorage.clear();
            return localforage.ready().then(function () {
                return new Promise((resolve) => localforage.clear(resolve));
            });
        });

        it('has a localStorage API', async function () {
            expect(localforage.getItem).to.be.a('function');
            expect(localforage.setItem).to.be.a('function');
            expect(localforage.clear).to.be.a('function');
            expect(localforage.length).to.be.a('function');
            expect(localforage.removeItem).to.be.a('function');
            expect(localforage.key).to.be.a('function');
        });

        it('has the localForage API', async function () {
            expect(localforage._initStorage).to.be.a('function');
            expect(localforage.config).to.be.a('function');
            expect(localforage.defineDriver).to.be.a('function');
            expect(localforage.driver).to.be.a('function');
            expect(localforage.supports).to.be.a('function');
            expect(localforage.iterate).to.be.a('function');
            expect(localforage.getItem).to.be.a('function');
            expect(localforage.setItem).to.be.a('function');
            expect(localforage.clear).to.be.a('function');
            expect(localforage.length).to.be.a('function');
            expect(localforage.removeItem).to.be.a('function');
            expect(localforage.key).to.be.a('function');
            expect(localforage.getDriver).to.be.a('function');
            expect(localforage.setDriver).to.be.a('function');
            expect(localforage.ready).to.be.a('function');
            expect(localforage.createInstance).to.be.a('function');
            expect(localforage.getSerializer).to.be.a('function');
            expect(localforage.dropInstance).to.be.a('function');
        });

        // Make sure we don't support bogus drivers.
        it('supports ' + driverName + ' database driver', async function () {
            expect(localforage.supports(driverName) === true);
            expect(localforage.supports('I am not a driver') === false);
        });

        it('sets the right database driver', async function () {
            expect(localforage.driver() === driverName);
        });

        it('has an empty length by default', function () {
            return localforage.length(function (err, length) {
                expect(length).to.be.eq(0);
            });
        });

        if (driverName === localforage.INDEXEDDB) {
            const localforageIDB = localforage as any as import('drivers/indexeddb').Module;

            describe('Blob support', function () {
                let transaction: IDBDatabase['transaction'];
                let called: number;
                let db: IDBDatabase;
                const blob = new Blob([''], { type: 'image/png' });

                before(function () {
                    db = localforageIDB._dbInfo.db!;
                    transaction = db.transaction;
                    db.transaction = function () {
                        called += 1;
                        return transaction.apply(db, arguments as any);
                    };
                });

                beforeEach(function () {
                    called = 0;
                });

                it('not check for non Blob', function () {
                    return localforage.setItem('key', {}).then(function () {
                        expect(called).to.be.eq(1);
                    });
                });

                it('check for Blob', function () {
                    return localforage.setItem('key', blob).then(function () {
                        expect(called).to.be.above(1);
                    });
                });

                it('check for Blob once', function () {
                    return localforage.setItem('key', blob).then(function () {
                        expect(called).to.be.eq(1);
                    });
                });

                after(function () {
                    localforageIDB._dbInfo.db!.transaction = transaction;
                });
            });

            describe('recover (reconnect) from IDBDatabase InvalidStateError', function () {
                beforeEach(function () {
                    return Promise.all([
                        localforage.setItem('key', 'value1'),
                        localforage.setItem('key1', 'value1'),
                        localforage.setItem('key2', 'value2'),
                        localforage.setItem('key3', 'value3')
                    ]).then(function () {
                        localforageIDB._dbInfo.db!.close();
                    });
                });

                it('retrieves an item from the storage', function () {
                    return localforage.getItem('key').then(function (value) {
                        expect(value).to.be.eq('value1');
                    });
                });

                it('retrieves more than one items from the storage', function () {
                    return Promise.all([
                        localforage.getItem('key1'),
                        localforage.getItem('key2'),
                        localforage.getItem('key3')
                    ]).then(function (values) {
                        expect(values).to.eql(['value1', 'value2', 'value3']);
                    });
                });

                it('stores and retrieves an item from the storage', function () {
                    return localforage
                        .setItem('key', 'value1b')
                        .then(function () {
                            return localforage.getItem('key');
                        })
                        .then(function (value) {
                            expect(value).to.be.eq('value1b');
                        });
                });

                it('stores and retrieves more than one items from the storage', function () {
                    return Promise.all([
                        localforage.setItem('key1', 'value1b'),
                        localforage.setItem('key2', 'value2b'),
                        localforage.setItem('key3', 'value3b')
                    ])
                        .then(function () {
                            return Promise.all([
                                localforage.getItem('key1'),
                                localforage.getItem('key2'),
                                localforage.getItem('key3')
                            ]);
                        })
                        .then(function (values) {
                            expect(values).to.eql(['value1b', 'value2b', 'value3b']);
                        });
                });
            });
        }

        if (driverName === localforage.WEBSQL) {
            const localforageWSQL = localforage as any as import('drivers/websql').Module;

            describe('on QUOTA ERROR', function () {
                let transaction: Database['transaction'];
                let called: number;
                let db: Database;

                function getQuotaErrorCode(transaction: Database['transaction']) {
                    return new Promise<any>(function (resolve) {
                        transaction.call(
                            db,
                            function (t) {
                                t.executeSql('');
                            },
                            function (err: any) {
                                resolve(err.QUOTA_ERR);
                            }
                        );
                    }).catch(function (err) {
                        return err.QUOTA_ERR;
                    });
                }

                beforeEach(function () {
                    called = 0;
                    db = localforageWSQL._dbInfo.db!;
                    transaction = db.transaction;

                    db.transaction = function (fn, errFn) {
                        called += 1;
                        // restore the normal transaction,
                        // so that subsequent operations work
                        db.transaction = transaction;

                        getQuotaErrorCode(transaction).then(function (QUOTA_ERR) {
                            const error = new Error() as any as SQLError;
                            error.code = QUOTA_ERR;
                            error.QUOTA_ERR = QUOTA_ERR;
                            errFn!(error);
                        });
                    };
                });

                it('should retry setItem', function () {
                    return localforage.setItem('key', {}).then(function () {
                        expect(called).to.be.eq(1);
                    });
                });

                after(function () {
                    db.transaction = transaction || db.transaction;
                });
            });
        }

        it('should iterate [callback]', function () {
            return localforage.setItem('officeX', 'InitechX', function (err, setValue) {
                expect(setValue).to.be.eq('InitechX');

                return localforage.getItem('officeX', function (err, value) {
                    expect(value).to.be.eq(setValue);

                    return localforage.setItem('officeY', 'InitechY', function (err, setValue) {
                        expect(setValue).to.be.eq('InitechY');

                        return localforage.getItem('officeY', function (err, value) {
                            expect(value).to.be.eq(setValue);

                            const accumulator: any = {};
                            const iterationNumbers: number[] = [];

                            return localforage.iterate(
                                function (value, key, iterationNumber) {
                                    accumulator[key] = value;
                                    iterationNumbers.push(iterationNumber);
                                },
                                function () {
                                    expect(accumulator.officeX).to.be.eq('InitechX');
                                    expect(accumulator.officeY).to.be.eq('InitechY');
                                    expect(iterationNumbers).to.eql([1, 2]);
                                }
                            );
                        });
                    });
                });
            });
        });

        it('should iterate [promise]', function () {
            const accumulator: any = {};
            const iterationNumbers: number[] = [];

            return localforage
                .setItem('officeX', 'InitechX')
                .then(function (setValue) {
                    expect(setValue).to.be.eq('InitechX');
                    return localforage.getItem('officeX');
                })
                .then(function (value) {
                    expect(value).to.be.eq('InitechX');
                    return localforage.setItem('officeY', 'InitechY');
                })
                .then(function (setValue) {
                    expect(setValue).to.be.eq('InitechY');
                    return localforage.getItem('officeY');
                })
                .then(function (value) {
                    expect(value).to.be.eq('InitechY');

                    return localforage.iterate(function (value, key, iterationNumber) {
                        accumulator[key] = value;
                        iterationNumbers.push(iterationNumber);
                    });
                })
                .then(function () {
                    expect(accumulator.officeX).to.be.eq('InitechX');
                    expect(accumulator.officeY).to.be.eq('InitechY');
                    expect(iterationNumbers).to.eql([1, 2]);
                });
        });

        it('should break iteration with defined return value [callback]', function () {
            const breakCondition = 'Some value!';

            return localforage.setItem('officeX', 'InitechX', function (err, setValue) {
                expect(setValue).to.be.eq('InitechX');

                return localforage.getItem('officeX', function (err, value) {
                    expect(value).to.be.eq(setValue);

                    return localforage.setItem('officeY', 'InitechY', function (err, setValue) {
                        expect(setValue).to.be.eq('InitechY');

                        return localforage.getItem('officeY', function (err, value) {
                            expect(value).to.be.eq(setValue);

                            // Loop is broken within first iteration.
                            return localforage.iterate(
                                function () {
                                    // Returning defined value will break the cycle.
                                    return breakCondition;
                                },
                                function (err, loopResult) {
                                    // The value that broken the cycle is returned
                                    // as a result.
                                    expect(loopResult).to.be.eq(breakCondition);
                                }
                            );
                        });
                    });
                });
            });
        });

        it('should break iteration with defined return value [promise]', function () {
            const breakCondition = 'Some value!';

            return localforage
                .setItem('officeX', 'InitechX')
                .then(function (setValue) {
                    expect(setValue).to.be.eq('InitechX');
                    return localforage.getItem('officeX');
                })
                .then(function (value) {
                    expect(value).to.be.eq('InitechX');
                    return localforage.setItem('officeY', 'InitechY');
                })
                .then(function (setValue) {
                    expect(setValue).to.be.eq('InitechY');
                    return localforage.getItem('officeY');
                })
                .then(function (value) {
                    expect(value).to.be.eq('InitechY');
                    return localforage.iterate(function () {
                        return breakCondition;
                    });
                })
                .then(function (result) {
                    expect(result).to.be.eq(breakCondition);
                });
        });

        it('should iterate() through only its own keys/values', function () {
            localStorage.setItem('local', 'forage');
            return localforage
                .setItem('office', 'Initech')
                .then(function () {
                    return localforage.setItem('name', 'Bob');
                })
                .then(function () {
                    // Loop through all key/value pairs; {local: 'forage'} set
                    // manually should not be returned.
                    let numberOfItems = 0;
                    let iterationNumberConcat = '';

                    localStorage.setItem('locals', 'forages');

                    return localforage.iterate(
                        function (value, key, iterationNumber) {
                            expect(key).to.not.be.eq('local');
                            expect(value).to.not.be.eq('forage');
                            numberOfItems++;
                            iterationNumberConcat += iterationNumber;
                        },
                        function (err) {
                            if (!err) {
                                // While there are 4 items in localStorage,
                                // only 2 items were set using localForage.
                                expect(numberOfItems).to.be.eq(2);

                                // Only 2 items were set using localForage,
                                // so we should get '12' and not '1234'
                                expect(iterationNumberConcat).to.be.eq('12');
                            }
                        }
                    );
                });
        });

        // Test for https://github.com/mozilla/localForage/issues/175
        it('nested getItem inside clear works [callback]', function () {
            return localforage.setItem('hello', 'Hello World !', function () {
                return localforage.clear(function () {
                    return localforage.getItem('hello', function (secondValue) {
                        expect(secondValue).to.be.eq(null);
                    });
                });
            });
        });
        it('nested getItem inside clear works [promise]', function () {
            return localforage
                .setItem('hello', 'Hello World !')
                .then(function () {
                    return localforage.clear();
                })
                .then(function () {
                    return localforage.getItem('hello');
                })
                .then(function (secondValue) {
                    expect(secondValue).to.be.eq(null);
                });
        });

        // Because localStorage doesn't support saving the `undefined` type, we
        // always return `null` so that localForage is consistent across
        // browsers.
        // https://github.com/mozilla/localForage/pull/42
        it('returns null for undefined key [callback]', function () {
            return localforage.getItem('key', function (err, value) {
                expect(value).to.be.eq(null);
            });
        });

        it('returns null for undefined key [promise]', function () {
            return localforage.getItem('key').then(function (value) {
                expect(value).to.be.eq(null);
            });
        });

        it('saves an item [callback]', function () {
            return localforage.setItem('office', 'Initech', function (err, setValue) {
                expect(setValue).to.be.eq('Initech');

                return localforage.getItem('office', function (err, value) {
                    expect(value).to.be.eq(setValue);
                });
            });
        });

        it('saves an item [promise]', function () {
            return localforage
                .setItem('office', 'Initech')
                .then(function (setValue) {
                    expect(setValue).to.be.eq('Initech');

                    return localforage.getItem('office');
                })
                .then(function (value) {
                    expect(value).to.be.eq('Initech');
                });
        });

        it('saves an item over an existing key [callback]', function () {
            return localforage.setItem('4th floor', 'Mozilla', function (err, setValue) {
                expect(setValue).to.be.eq('Mozilla');

                return localforage.setItem('4th floor', 'Quora', function (err, newValue) {
                    expect(newValue).to.not.be.eq(setValue);
                    expect(newValue).to.be.eq('Quora');

                    return localforage.getItem('4th floor', function (err, value) {
                        expect(value).to.not.be.eq(setValue);
                        expect(value).to.be.eq(newValue);
                    });
                });
            });
        });
        it('saves an item over an existing key [promise]', function () {
            return localforage
                .setItem('4e', 'Mozilla')
                .then(function (setValue) {
                    expect(setValue).to.be.eq('Mozilla');

                    return localforage.setItem('4e', 'Quora');
                })
                .then(function (newValue) {
                    expect(newValue).to.not.be.eq('Mozilla');
                    expect(newValue).to.be.eq('Quora');

                    return localforage.getItem('4e');
                })
                .then(function (value) {
                    expect(value).to.not.be.eq('Mozilla');
                    expect(value).to.be.eq('Quora');
                });
        });

        it('returns null when saving undefined [callback]', function () {
            return localforage.setItem('undef', undefined, function (err, setValue) {
                expect(setValue).to.be.eq(null);
            });
        });
        it('returns null when saving undefined [promise]', function () {
            return localforage.setItem('undef', undefined).then(function (setValue) {
                expect(setValue).to.be.eq(null);
            });
        });

        it('returns null when saving null [callback]', function () {
            return localforage.setItem('null', null, function (err, setValue) {
                expect(setValue).to.be.eq(null);
            });
        });
        it('returns null when saving null [promise]', function () {
            return localforage.setItem('null', null).then(function (setValue) {
                expect(setValue).to.be.eq(null);
            });
        });

        it('returns null for a non-existant key [callback]', function () {
            return localforage.getItem('undef', function (err, value) {
                expect(value).to.be.eq(null);
            });
        });
        it('returns null for a non-existant key [promise]', function () {
            return localforage.getItem('undef').then(function (value) {
                expect(value).to.be.eq(null);
            });
        });

        // github.com/mozilla/localforage/pull/24#discussion-diff-9389662R158
        // localStorage's method API (`localStorage.getItem('foo')`) returns
        // `null` for undefined keys, even though its getter/setter API
        // (`localStorage.foo`) returns `undefined` for the same key. Gaia's
        // asyncStorage API, which is based on localStorage and upon which
        // localforage is based, ALSO returns `null`. BLARG! So for now, we
        // just return null, because there's no way to know from localStorage
        // if the key is ACTUALLY `null` or undefined but returning `null`.
        // And returning `undefined` here would break compatibility with
        // localStorage fallback. Maybe in the future we won't care...
        it('returns null from an undefined key [callback]', function () {
            return localforage.key(0, function (err, key) {
                expect(key).to.be.eq(null);
            });
        });
        it('returns null from an undefined key [promise]', function () {
            return localforage.key(0).then(function (key) {
                expect(key).to.be.eq(null);
            });
        });

        it('returns key name [callback]', function () {
            return localforage.setItem('office', 'Initech').then(function () {
                return localforage.key(0, function (err, key) {
                    expect(key).to.be.eq('office');
                });
            });
        });
        it('returns key name [promise]', function () {
            return localforage
                .setItem('office', 'Initech')
                .then(function () {
                    return localforage.key(0);
                })
                .then(function (key) {
                    expect(key).to.be.eq('office');
                });
        });

        it('removes an item [callback]', function () {
            return localforage.setItem('office', 'Initech', function () {
                return localforage.setItem('otherOffice', 'Initrode', function () {
                    return localforage.removeItem('office', function () {
                        return localforage.getItem('office', function (err, emptyValue) {
                            expect(emptyValue).to.be.eq(null);

                            return localforage.getItem('otherOffice', function (err, value) {
                                expect(value).to.be.eq('Initrode');
                            });
                        });
                    });
                });
            });
        });
        it('removes an item [promise]', function () {
            return localforage
                .setItem('office', 'Initech')
                .then(function () {
                    return localforage.setItem('otherOffice', 'Initrode');
                })
                .then(function () {
                    return localforage.removeItem('office');
                })
                .then(function () {
                    return localforage.getItem('office');
                })
                .then(function (emptyValue) {
                    expect(emptyValue).to.be.eq(null);

                    return localforage.getItem('otherOffice');
                })
                .then(function (value) {
                    expect(value).to.be.eq('Initrode');
                });
        });

        it('removes all items [callback]', function () {
            return localforage.setItem('office', 'Initech', function () {
                return localforage.setItem('otherOffice', 'Initrode', function () {
                    return localforage.length(function (err, length) {
                        expect(length).to.be.eq(2);

                        return localforage.clear(function () {
                            return localforage.getItem('office', function (err, value) {
                                expect(value).to.be.eq(null);

                                return localforage.length(function (err, length) {
                                    expect(length).to.be.eq(0);
                                });
                            });
                        });
                    });
                });
            });
        });
        it('removes all items [promise]', function () {
            return localforage
                .setItem('office', 'Initech')
                .then(function () {
                    return localforage.setItem('otherOffice', 'Initrode');
                })
                .then(function () {
                    return localforage.length();
                })
                .then(function (length) {
                    expect(length).to.be.eq(2);

                    return localforage.clear();
                })
                .then(function () {
                    return localforage.getItem('office');
                })
                .then(function (value) {
                    expect(value).to.be.eq(null);

                    return localforage.length();
                })
                .then(function (length) {
                    expect(length).to.be.eq(0);
                });
        });

        if (driverName === localforage.LOCALSTORAGE) {
            it('removes only own items upon clear', function () {
                localStorage.setItem('local', 'forage');

                return localforage
                    .setItem('office', 'Initech')
                    .then(function () {
                        return localforage.clear();
                    })
                    .then(function () {
                        expect(localStorage.getItem('local')).to.be.eq('forage');

                        localStorage.clear();
                    });
            });

            it('returns only its own keys from keys()', function () {
                localStorage.setItem('local', 'forage');

                return localforage
                    .setItem('office', 'Initech')
                    .then(function () {
                        return localforage.keys();
                    })
                    .then(function (keys) {
                        expect(keys).to.eql(['office']);

                        localStorage.clear();
                    });
            });

            it('counts only its own items with length()', function () {
                localStorage.setItem('local', 'forage');
                localStorage.setItem('another', 'value');

                return localforage
                    .setItem('office', 'Initech')
                    .then(function () {
                        return localforage.length();
                    })
                    .then(function (length) {
                        expect(length).to.be.eq(1);

                        localStorage.clear();
                    });
            });
        }

        it('has a length after saving an item [callback]', function () {
            return localforage.length(function (err, length) {
                expect(length).to.be.eq(0);
                return localforage.setItem('rapper', 'Black Thought', function () {
                    return localforage.length(function (err, length) {
                        expect(length).to.be.eq(1);
                    });
                });
            });
        });
        it('has a length after saving an item [promise]', function () {
            return localforage
                .length()
                .then(function (length) {
                    expect(length).to.be.eq(0);

                    return localforage.setItem('lame rapper', 'Vanilla Ice');
                })
                .then(function () {
                    return localforage.length();
                })
                .then(function (length) {
                    expect(length).to.be.eq(1);
                });
        });

        // Deal with non-string keys, see issue #250
        // https://github.com/mozilla/localForage/issues/250
        it('casts an undefined key to a String', function () {
            return localforage
                .setItem(undefined!, 'goodness!')
                .then(function (value) {
                    expect(value).to.be.eq('goodness!');

                    return localforage.getItem(undefined!);
                })
                .then(function (value) {
                    expect(value).to.be.eq('goodness!');

                    return localforage.removeItem(undefined!);
                })
                .then(function () {
                    return localforage.length();
                })
                .then(function (length) {
                    expect(length).to.be.eq(0);
                });
        });

        it('casts a null key to a String', function () {
            return localforage
                .setItem(null!, 'goodness!')
                .then(function (value) {
                    expect(value).to.be.eq('goodness!');

                    return localforage.getItem(null!);
                })
                .then(function (value) {
                    expect(value).to.be.eq('goodness!');

                    return localforage.removeItem(null!);
                })
                .then(function () {
                    return localforage.length();
                })
                .then(function (length) {
                    expect(length).to.be.eq(0);
                });
        });

        it('casts a float key to a String', function () {
            return localforage
                .setItem(537.35737 as any, 'goodness!')
                .then(function (value) {
                    expect(value).to.be.eq('goodness!');

                    return localforage.getItem(537.35737 as any);
                })
                .then(function (value) {
                    expect(value).to.be.eq('goodness!');

                    return localforage.removeItem(537.35737 as any);
                })
                .then(function () {
                    return localforage.length();
                })
                .then(function (length) {
                    expect(length).to.be.eq(0);
                });
        });

        it('is retrieved by getDriver [callback]', function () {
            return localforage.getDriver(driverName, function (driver) {
                expect(typeof driver).to.be.eq('object');
                driverApiMethods.concat('_initStorage').forEach(function (methodName) {
                    expect(typeof driver[methodName as keyof typeof driver]).to.be.eq('function');
                });
                expect(driver._driver).to.be.eq(driverName);
            });
        });

        it('is retrieved by getDriver [promise]', function () {
            return localforage.getDriver(driverName).then(function (driver) {
                expect(typeof driver).to.be.eq('object');
                driverApiMethods.concat('_initStorage').forEach(function (methodName) {
                    expect(typeof driver[methodName as keyof typeof driver]).to.be.eq('function');
                });
                expect(driver._driver).to.be.eq(driverName);
            });
        });

        if (driverName === localforage.WEBSQL || driverName === localforage.LOCALSTORAGE) {
            const localforageLOCAL = localforage as any as import('drivers/localstorage').Module;

            it('exposes the serializer on the dbInfo object', function () {
                return localforage.ready().then(function () {
                    if (window.callWhenReadyTest) {
                        return;
                    }
                    expect(localforageLOCAL._dbInfo.serializer).to.be.an('object');
                });
            });
        }
    });

    function prepareStorage(storageName: string) {
        // Delete IndexedDB storages (start from scratch)
        // Refers to issue #492 - https://github.com/mozilla/localForage/issues/492
        if (driverName === localforage.INDEXEDDB) {
            return new Promise(function (resolve) {
                indexedDB.deleteDatabase(storageName).onsuccess = resolve;
            });
        }

        // Otherwise, do nothing
        return Promise.resolve();
    }

    describe(driverName + ' driver multiple instances', function () {
        this.timeout(30000);

        let localforage2 = {} as LocalForageDriver;
        let localforage3 = {} as LocalForageDriver;

        before(function () {
            return prepareStorage('storage2').then(function () {
                localforage2 = localforage.createInstance({
                    name: 'storage2',
                    // We need a small value here
                    // otherwise local PhantomJS test
                    // will fail with SECURITY_ERR.
                    // TravisCI seem to work fine though.
                    size: 1024,
                    storeName: 'storagename2'
                });

                // Same name, but different storeName since this has been
                // malfunctioning before w/ IndexedDB.
                localforage3 = localforage.createInstance({
                    name: 'storage2',
                    // We need a small value here
                    // otherwise local PhantomJS test
                    // will fail with SECURITY_ERR.
                    // TravisCI seem to work fine though.
                    size: 1024,
                    storeName: 'storagename3'
                });

                return Promise.all([
                    localforage.setDriver(driverName),
                    localforage2.setDriver(driverName),
                    localforage3.setDriver(driverName)
                ]);
            });
        });

        beforeEach(function () {
            return Promise.all([localforage.clear(), localforage2.clear(), localforage3.clear()]);
        });

        it('is not be able to access values of other instances', function () {
            return Promise.all([
                localforage.setItem('key1', 'value1a'),
                localforage2.setItem('key2', 'value2a'),
                localforage3.setItem('key3', 'value3a')
            ]).then(function () {
                return Promise.all([
                    localforage.getItem('key2').then(function (value) {
                        expect(value).to.be.eq(null);
                    }),
                    localforage2.getItem('key1').then(function (value) {
                        expect(value).to.be.eq(null);
                    }),
                    localforage2.getItem('key3').then(function (value) {
                        expect(value).to.be.eq(null);
                    }),
                    localforage3.getItem('key2').then(function (value) {
                        expect(value).to.be.eq(null);
                    })
                ]);
            });
        });

        it('retrieves the proper value when using the same key with other instances', function () {
            return Promise.all([
                localforage.setItem('key', 'value1'),
                localforage2.setItem('key', 'value2'),
                localforage3.setItem('key', 'value3')
            ]).then(function () {
                return Promise.all([
                    localforage.getItem('key').then(function (value) {
                        expect(value).to.be.eq('value1');
                    }),
                    localforage2.getItem('key').then(function (value) {
                        expect(value).to.be.eq('value2');
                    }),
                    localforage3.getItem('key').then(function (value) {
                        expect(value).to.be.eq('value3');
                    })
                ]);
            });
        });
    });

    // Refers to issue #492 - https://github.com/mozilla/localForage/issues/492
    describe(driverName + ' driver multiple instances (concurrent on same database)', function () {
        this.timeout(30000);

        before(function () {
            return Promise.all([
                prepareStorage('storage3'),
                prepareStorage('commonStorage'),
                prepareStorage('commonStorage2'),
                prepareStorage('commonStorage3')
            ]);
        });

        it('chains operation on multiple stores', function () {
            const localforage1 = localforage.createInstance({
                name: 'storage3',
                storeName: 'store1',
                size: 1024
            });

            const localforage2 = localforage.createInstance({
                name: 'storage3',
                storeName: 'store2',
                size: 1024
            });

            const localforage3 = localforage.createInstance({
                name: 'storage3',
                storeName: 'store3',
                size: 1024
            });

            const promise1 = localforage1
                .setItem('key', 'value1')
                .then(function () {
                    return localforage1.getItem('key');
                })
                .then(function (value) {
                    expect(value).to.be.eq('value1');
                });

            const promise2 = localforage2
                .setItem('key', 'value2')
                .then(function () {
                    return localforage2.getItem('key');
                })
                .then(function (value) {
                    expect(value).to.be.eq('value2');
                });

            const promise3 = localforage3
                .setItem('key', 'value3')
                .then(function () {
                    return localforage3.getItem('key');
                })
                .then(function (value) {
                    expect(value).to.be.eq('value3');
                });

            return Promise.all([promise1, promise2, promise3]);
        });

        it('can create multiple instances of the same store', function () {
            let localforage1 = {} as LocalForageDriver;
            let localforage2 = {} as LocalForageDriver;
            let localforage3 = {} as LocalForageDriver;

            return Promise.resolve()
                .then(function () {
                    localforage1 = localforage.createInstance({
                        name: 'commonStorage',
                        storeName: 'commonStore',
                        size: 1024
                    });
                    return localforage1.ready();
                })
                .then(function () {
                    localforage2 = localforage.createInstance({
                        name: 'commonStorage',
                        storeName: 'commonStore',
                        size: 1024
                    });
                    return localforage2.ready();
                })
                .then(function () {
                    localforage3 = localforage.createInstance({
                        name: 'commonStorage',
                        storeName: 'commonStore',
                        size: 1024
                    });
                    return localforage3.ready();
                })
                .then(function () {
                    return Promise.resolve()
                        .then(function () {
                            return localforage1
                                .setItem('key1', 'value1')
                                .then(function () {
                                    return localforage1.getItem('key1');
                                })
                                .then(function (value) {
                                    expect(value).to.be.eq('value1');
                                });
                        })
                        .then(function () {
                            return localforage2
                                .setItem('key2', 'value2')
                                .then(function () {
                                    return localforage2.getItem('key2');
                                })
                                .then(function (value) {
                                    expect(value).to.be.eq('value2');
                                });
                        })
                        .then(function () {
                            return localforage3
                                .setItem('key3', 'value3')
                                .then(function () {
                                    return localforage3.getItem('key3');
                                })
                                .then(function (value) {
                                    expect(value).to.be.eq('value3');
                                });
                        });
                });
        });

        it('can create multiple instances of the same store and do concurrent operations', function () {
            let localforage1 = {} as LocalForageDriver;
            let localforage2 = {} as LocalForageDriver;
            let localforage3 = {} as LocalForageDriver;
            let localforage3b = {} as LocalForageDriver;

            return Promise.resolve()
                .then(function () {
                    localforage1 = localforage.createInstance({
                        name: 'commonStorage2',
                        storeName: 'commonStore',
                        size: 1024
                    });
                    return localforage1.ready();
                })
                .then(function () {
                    localforage2 = localforage.createInstance({
                        name: 'commonStorage2',
                        storeName: 'commonStore',
                        size: 1024
                    });
                    return localforage2.ready();
                })
                .then(function () {
                    localforage3 = localforage.createInstance({
                        name: 'commonStorage2',
                        storeName: 'commonStore',
                        size: 1024
                    });
                    return localforage3.ready();
                })
                .then(function () {
                    localforage3b = localforage.createInstance({
                        name: 'commonStorage2',
                        storeName: 'commonStore',
                        size: 1024
                    });
                    return localforage3b.ready();
                })
                .then(function () {
                    const promise1 = localforage1
                        .setItem('key1', 'value1')
                        .then(function () {
                            return localforage1.getItem('key1');
                        })
                        .then(function (value) {
                            expect(value).to.be.eq('value1');
                        });

                    const promise2 = localforage2
                        .setItem('key2', 'value2')
                        .then(function () {
                            return localforage2.getItem('key2');
                        })
                        .then(function (value) {
                            expect(value).to.be.eq('value2');
                        });

                    const promise3 = localforage3
                        .setItem('key3', 'value3')
                        .then(function () {
                            return localforage3.getItem('key3');
                        })
                        .then(function (value) {
                            expect(value).to.be.eq('value3');
                        });

                    const promise4 = localforage3b
                        .setItem('key3', 'value3')
                        .then(function () {
                            return localforage3.getItem('key3');
                        })
                        .then(function (value) {
                            expect(value).to.be.eq('value3');
                        });

                    return Promise.all([promise1, promise2, promise3, promise4]);
                });
        });

        it('can create multiple instances of the same store concurrently', function () {
            const localforage1 = localforage.createInstance({
                name: 'commonStorage3',
                storeName: 'commonStore',
                size: 1024
            });

            const localforage2 = localforage.createInstance({
                name: 'commonStorage3',
                storeName: 'commonStore',
                size: 1024
            });

            const localforage3 = localforage.createInstance({
                name: 'commonStorage3',
                storeName: 'commonStore',
                size: 1024
            });

            const localforage3b = localforage.createInstance({
                name: 'commonStorage3',
                storeName: 'commonStore',
                size: 1024
            });

            const promise1 = localforage1
                .setItem('key1', 'value1')
                .then(function () {
                    return localforage1.getItem('key1');
                })
                .then(function (value) {
                    expect(value).to.be.eq('value1');
                });

            const promise2 = localforage2
                .setItem('key2', 'value2')
                .then(function () {
                    return localforage2.getItem('key2');
                })
                .then(function (value) {
                    expect(value).to.be.eq('value2');
                });

            const promise3 = localforage3
                .setItem('key3', 'value3')
                .then(function () {
                    return localforage3.getItem('key3');
                })
                .then(function (value) {
                    expect(value).to.be.eq('value3');
                });

            const promise4 = localforage3b
                .setItem('key3', 'value3')
                .then(function () {
                    return localforage3.getItem('key3');
                })
                .then(function (value) {
                    expect(value).to.be.eq('value3');
                });

            return Promise.all([promise1, promise2, promise3, promise4]);
        });
    });

    describe(driverName + ' driver', function () {
        let driverPreferedOrder: string[];

        before(function () {
            // add some unsupported drivers before
            // and after the target driver
            driverPreferedOrder = ['I am a not supported driver'];

            if (!localforage.supports(localforage.WEBSQL)) {
                driverPreferedOrder.push(localforage.WEBSQL);
            }
            if (!localforage.supports(localforage.INDEXEDDB)) {
                driverPreferedOrder.push(localforage.INDEXEDDB);
            }
            if (!localforage.supports(localforage.LOCALSTORAGE)) {
                driverPreferedOrder.push(localforage.LOCALSTORAGE);
            }

            driverPreferedOrder.push(driverName);

            driverPreferedOrder.push('I am another not supported driver');
        });

        it('is used according to setDriver preference order', function () {
            return localforage.setDriver(driverPreferedOrder).then(function () {
                expect(localforage.driver()).to.be.eq(driverName);
            });
        });
    });

    describe(driverName + ' driver when the callback throws an Error', function () {
        const testObj = {
            throwFunc: function () {
                testObj.throwFuncCalls++;
                throw new Error('Thrown test error');
            },
            throwFuncCalls: 0
        };

        beforeEach(function () {
            testObj.throwFuncCalls = 0;
        });

        it('resolves the promise of getItem()', function () {
            return localforage.getItem('key', testObj.throwFunc).then(function () {
                expect(testObj.throwFuncCalls).to.be.eq(1);
            });
        });

        it('resolves the promise of setItem()', function () {
            return localforage.setItem('key', 'test', testObj.throwFunc).then(function () {
                expect(testObj.throwFuncCalls).to.be.eq(1);
            });
        });

        it('resolves the promise of clear()', function () {
            return localforage.clear(testObj.throwFunc).then(function () {
                expect(testObj.throwFuncCalls).to.be.eq(1);
            });
        });

        it('resolves the promise of length()', function () {
            return localforage.length(testObj.throwFunc).then(function () {
                expect(testObj.throwFuncCalls).to.be.eq(1);
            });
        });

        it('resolves the promise of removeItem()', function () {
            return localforage.removeItem('key', testObj.throwFunc).then(function () {
                expect(testObj.throwFuncCalls).to.be.eq(1);
            });
        });

        it('resolves the promise of key()', function () {
            return localforage.key(0, testObj.throwFunc).then(function () {
                expect(testObj.throwFuncCalls).to.be.eq(1);
            });
        });

        it('resolves the promise of keys()', function () {
            return localforage.keys(testObj.throwFunc).then(function () {
                expect(testObj.throwFuncCalls).to.be.eq(1);
            });
        });
    });

    describe(driverName + ' driver when ready() gets rejected', function () {
        this.timeout(30000);

        let _oldReady: typeof localforage.ready;

        beforeEach(function () {
            _oldReady = localforage.ready;
            localforage.ready = function () {
                return Promise.reject(true);
            };
        });

        afterEach(function () {
            localforage.ready = _oldReady;
            _oldReady = null!;
        });

        driverApiMethods.forEach(function (methodName) {
            it('rejects ' + methodName + '() promise', function () {
                return (localforage as any)[methodName]().then(null, function (err: any) {
                    expect(err).to.be.true;
                });
            });
        });
    });
});

DRIVERS.forEach(function (driverName) {
    describe(driverName + ' driver instance', function () {
        it('creates a new instance and sets the driver', function () {
            const localforage2 = localforage.createInstance({
                name: 'storage2',
                driver: driverName,
                // We need a small value here
                // otherwise local PhantomJS test
                // will fail with SECURITY_ERR.
                // TravisCI seem to work fine though.
                size: 1024,
                storeName: 'storagename2'
            });

            // since config actually uses setDriver which is async,
            // and since driver() and supports() are not defered (are sync),
            // we have to wait till an async method returns
            return localforage2.length().then(
                function () {
                    expect(localforage2.driver()).to.be.eq(driverName);
                },
                function () {
                    expect(localforage2.driver()).to.be.eq(null);
                }
            );
        });
    });
});

SUPPORTED_DRIVERS.forEach(function (driverName) {
    describe(driverName + ' driver dropInstance', function () {
        this.timeout(80000);

        function setCommonOpts(opts: { name: string; storeName: string }) {
            return {
                ...opts,
                driver: driverName,
                size: 1024
            };
        }

        const dropStoreDbName = 'dropStoreDb';

        let nodropInstance = {} as LocalForageDriver;
        const nodropInstanceOptions = setCommonOpts({
            name: dropStoreDbName,
            storeName: 'nodropStore'
        });

        let dropStoreInstance1 = {} as LocalForageDriver;
        const dropStoreInstance1Options = setCommonOpts({
            name: dropStoreDbName,
            storeName: 'dropStore'
        });

        let dropStoreInstance2 = {} as LocalForageDriver;
        const dropStoreInstance2Options = setCommonOpts({
            name: dropStoreDbName,
            storeName: 'dropStore2'
        });

        let dropStoreInstance3 = {} as LocalForageDriver;
        const dropStoreInstance3Options = setCommonOpts({
            name: dropStoreDbName,
            storeName: 'dropStore3'
        });

        let dropDbInstance = {} as LocalForageDriver;
        const dropDbInstanceOptions = setCommonOpts({
            name: 'dropDb',
            storeName: 'dropStore'
        });

        let dropDb2Instance = {} as LocalForageDriver;
        const dropDb2InstanceOptions = setCommonOpts({
            name: 'dropDb2',
            storeName: 'dropStore'
        });

        const dropDb3name = 'dropDb3';

        let dropDb3Instance1 = {} as LocalForageDriver;
        const dropDb3Instance1Options = setCommonOpts({
            name: dropDb3name,
            storeName: 'dropStore1'
        });

        let dropDb3Instance2 = {} as LocalForageDriver;
        const dropDb3Instance2Options = setCommonOpts({
            name: dropDb3name,
            storeName: 'dropStore2'
        });

        let dropDb3Instance3 = {} as LocalForageDriver;
        const dropDb3Instance3Options = setCommonOpts({
            name: dropDb3name,
            storeName: 'dropStore3'
        });

        before(function () {
            nodropInstance = localforage.createInstance(nodropInstanceOptions);
            dropStoreInstance1 = localforage.createInstance(dropStoreInstance1Options);
            dropStoreInstance2 = localforage.createInstance(dropStoreInstance2Options);
            dropStoreInstance3 = localforage.createInstance(dropStoreInstance3Options);
            dropDbInstance = localforage.createInstance(dropDbInstanceOptions);
            dropDb2Instance = localforage.createInstance(dropDb2InstanceOptions);
            dropDb3Instance1 = localforage.createInstance(dropDb3Instance1Options);
            dropDb3Instance2 = localforage.createInstance(dropDb3Instance2Options);
            dropDb3Instance3 = localforage.createInstance(dropDb3Instance3Options);
            return Promise.resolve()
                .then(function () {
                    return nodropInstance.setItem('key1', 'value0');
                })
                .then(function () {
                    return dropStoreInstance1.setItem('key1', 'value1');
                })
                .then(function () {
                    return dropStoreInstance2.setItem('key1', 'value2');
                })
                .then(function () {
                    return dropStoreInstance3.setItem('key1', 'value3');
                })
                .then(function () {
                    return dropDbInstance.setItem('key1', 'value3');
                })
                .then(function () {
                    return dropDb2Instance.setItem('key1', 'value3');
                })
                .then(function () {
                    return dropDb3Instance1.setItem('key1', 'value1');
                })
                .then(function () {
                    return dropDb3Instance2.setItem('key1', 'value2');
                })
                .then(function () {
                    return dropDb3Instance3.setItem('key1', 'value3');
                });
        });

        function expectStoreToNotExistAsync(options: { name: string; storeName: string }) {
            return new Promise<void>(function (resolve, reject) {
                if (driverName === localforage.INDEXEDDB) {
                    const req = indexedDB.open(options.name);
                    req.onsuccess = function () {
                        const db = req.result;
                        if (!db) {
                            reject();
                            return;
                        }
                        expect(db.objectStoreNames.contains(options.storeName)).to.be.eq(false);
                        db.close();
                        resolve();
                    };
                    req.onerror = req.onblocked = reject;
                } else if (driverName === localforage.WEBSQL) {
                    const db = openDatabase(options.name, '', '', 0);
                    db.transaction(function (t) {
                        t.executeSql(
                            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                            [options.storeName],
                            function (t, results) {
                                expect(results.rows.length).to.be.eq(0);
                                resolve();
                            },
                            function () {
                                reject();
                                return false;
                            }
                        );
                    }, reject);
                } else if (driverName === localforage.LOCALSTORAGE) {
                    const keyPrefix = (function _getKeyPrefix(options, defaultConfig) {
                        let keyPrefix = options.name + '/';

                        if (options.storeName !== defaultConfig.storeName) {
                            keyPrefix += options.storeName + '/';
                        }
                        return keyPrefix;
                    })(options, {
                        name: 'localforage',
                        storeName: 'keyvaluepairs'
                    });

                    let foundLocalStorageKey = false;
                    for (let i = 0, length = localStorage.length; i < length; i++) {
                        if (localStorage.key(i)?.indexOf(keyPrefix) === 0) {
                            foundLocalStorageKey = true;
                            break;
                        }
                    }
                    expect(foundLocalStorageKey).to.be.eq(false);
                    resolve();
                } else {
                    throw new Error('Not Implemented Exception');
                }
            });
        }

        it('drops the current instance without affecting the rest', function () {
            return dropStoreInstance1.dropInstance!()
                .then(function () {
                    return nodropInstance.getItem('key1');
                })
                .then(function (value) {
                    expect(value).to.be.eq('value0');
                });
        });

        it('can recreate and set values to previously dropped instances', function () {
            return dropStoreInstance1.dropInstance!()
                .then(function () {
                    return dropStoreInstance1.getItem('key1');
                })
                .then(function (value) {
                    expect(value).to.be.eq(null);
                    return dropStoreInstance1.length();
                })
                .then(function (length) {
                    expect(length).to.be.eq(0);
                })
                .then(function () {
                    return dropStoreInstance1.setItem('key1', 'newvalue2');
                })
                .then(function () {
                    return dropStoreInstance1.getItem('key1');
                })
                .then(function (value) {
                    expect(value).to.be.eq('newvalue2');
                });
        });

        it('drops an other instance without affecting the rest', function () {
            const opts = {
                name: dropStoreInstance2Options.name,
                storeName: dropStoreInstance2Options.storeName
            };
            return nodropInstance.dropInstance!(opts)
                .then(function () {
                    return nodropInstance.getItem('key1');
                })
                .then(function (value) {
                    expect(value).to.be.eq('value0');
                });
        });

        it('the dropped instance is completely removed', function () {
            const opts = {
                name: dropStoreInstance3Options.name,
                storeName: dropStoreInstance3Options.storeName
            };
            return dropStoreInstance3.dropInstance!().then(function () {
                return expectStoreToNotExistAsync(opts);
            });
        });

        it('resolves when trying to drop a store that does not exit', function () {
            const opts = {
                name: dropStoreInstance3Options.name,
                storeName: 'NotExistingStore' + Date.now()
            };
            return dropStoreInstance3.dropInstance!(opts);
        });

        function expectDBToNotExistAsync(options: { name: string }) {
            return new Promise<void>(function (resolve, reject) {
                if (driverName === localforage.INDEXEDDB) {
                    const req = indexedDB.open(options.name);
                    req.onsuccess = function () {
                        const db = req.result;
                        if (!db) {
                            reject();
                            return;
                        }
                        expect(db.objectStoreNames.length).to.be.eq(0);
                        db.close();
                        resolve();
                    };
                    req.onerror = req.onblocked = reject;
                } else if (driverName === localforage.WEBSQL) {
                    const db = openDatabase(options.name, '', '', 0);
                    db.transaction(function (t) {
                        t.executeSql(
                            "SELECT name FROM sqlite_master WHERE type='table'",
                            [],
                            function (t, results) {
                                const stores = Array.prototype.filter.call(
                                    results.rows,
                                    function (obj) {
                                        return obj && obj.name && obj.name.indexOf('__') !== 0;
                                    }
                                );
                                expect(stores.length).to.be.eq(0);
                                resolve();
                            },
                            function () {
                                reject();
                                return false;
                            }
                        );
                    }, reject);
                } else if (driverName === localforage.LOCALSTORAGE) {
                    const keyPrefix = (function _getKeyPrefix(options) {
                        return options.name + '/';
                    })(options);

                    let foundLocalStorageKey = false;
                    for (let i = 0, length = localStorage.length; i < length; i++) {
                        if (localStorage.key(i)?.indexOf(keyPrefix) === 0) {
                            foundLocalStorageKey = true;
                            break;
                        }
                    }
                    expect(foundLocalStorageKey).to.be.eq(false);
                    resolve();
                } else {
                    throw new Error('Not Implemented Exception');
                }
            });
        }

        it('the dropped "DB" can be recreated', function () {
            const opts = {
                name: dropDbInstanceOptions.name
            };
            return dropDbInstance.dropInstance!(opts)
                .then(function () {
                    return dropDbInstance.getItem('key1');
                })
                .then(function (value) {
                    expect(value).to.be.eq(null);
                });
        });

        it('the dropped "DB" is completely removed', function () {
            const opts = {
                name: dropDb2InstanceOptions.name
            };
            return dropDb2Instance.dropInstance!(opts).then(function () {
                return expectDBToNotExistAsync(opts);
            });
        });

        it('resolves when trying to drop a store of a "DB" that does not exit', function () {
            const opts = {
                name: 'NotExistingDB' + Date.now(),
                storeName: 'NotExistingStore' + Date.now()
            };
            return dropStoreInstance3.dropInstance!(opts);
        });

        it('resolves when trying to drop a "DB" that does not exist', function () {
            const opts = {
                name: 'NotExistingDB' + Date.now()
            };
            return dropStoreInstance3.dropInstance!(opts);
        });

        it('drops a "DB" that we previously dropped a store', function () {
            const opts = {
                name: dropStoreInstance3Options.name
            };
            return dropStoreInstance3.dropInstance!(opts).then(function () {
                return expectDBToNotExistAsync(opts);
            });
        });

        it('drops a "DB" after dropping all its stores', function () {
            const opts = {
                name: dropDb3name
            };
            // Before trying to drop a different store/DB
            // make sure that the instance that you will use
            // is configured to use the same driver as well.
            return Promise.resolve()
                .then(function () {
                    return dropDb3Instance1.dropInstance!({
                        name: dropDb3name,
                        storeName: dropDb3Instance1Options.storeName
                    });
                })
                .then(function () {
                    return dropDb3Instance1.dropInstance!({
                        name: dropDb3name,
                        storeName: dropDb3Instance2Options.storeName
                    });
                })
                .then(function () {
                    return dropDb3Instance1.dropInstance!({
                        name: dropDb3name,
                        storeName: dropDb3Instance3Options.storeName
                    });
                })
                .then(function () {
                    return dropDb3Instance1.dropInstance!(opts);
                })
                .then(function () {
                    return expectDBToNotExistAsync(opts);
                });
        });
    });
});
