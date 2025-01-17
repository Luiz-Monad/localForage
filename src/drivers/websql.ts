import isWebSQLValid from '../utils/isWebSQLValid';
import serializer from '../utils/serializer';
import Promise from '../utils/promise';
import executeCallback from '../utils/executeCallback';
import normalizeKey from '../utils/normalizeKey';
import getCallback from '../utils/getCallback';
import { Callback, DbIterator, Driver, Forage, InstanceOptions, Options } from '../types';

/*
 * Includes code from:
 *
 * base64-arraybuffer
 * https://github.com/niklasvh/base64-arraybuffer
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */

export interface Module extends Driver, Forage<DbInfo> {}

interface DbInfo extends Options {
    db: Database | null;
    version: number;
    description: string;
    size: number;
    serializer: typeof serializer;
}

interface Names {
    db: Database;
    storeNames: string[];
}

function createDbTable(
    t: SQLTransaction,
    dbInfo: DbInfo,
    callback: SQLStatementCallback,
    errorCallback: SQLStatementErrorCallback
) {
    t.executeSql(
        `CREATE TABLE IF NOT EXISTS ${dbInfo.storeName} ` +
            '(id INTEGER PRIMARY KEY, key unique, value)',
        [],
        callback,
        errorCallback
    );
}

// Open the WebSQL database (automatically creates one if one didn't
// previously exist), using any options set in the config.
function _initStorage(this: Module, options: Options) {
    const self = this;
    const dbInfo = {
        db: null
    } as DbInfo;

    if (options) {
        for (const i in options) {
            const _options = options as any;
            (dbInfo as any)[i] =
                typeof _options[i] !== 'string' ? _options[i].toString() : _options[i];
        }
    }

    const dbInfoPromise = new Promise<void>(function (resolve, reject) {
        // Open the database; the openDatabase API will automatically
        // create it for us if it doesn't exist.
        try {
            dbInfo.db = openDatabase(
                dbInfo.name,
                String(dbInfo.version),
                dbInfo.description,
                dbInfo.size
            );
        } catch (e) {
            return reject(e);
        }

        // Create our key/value table if it doesn't exist.
        dbInfo.db!.transaction(function (t) {
            createDbTable(
                t,
                dbInfo,
                function () {
                    self._dbInfo = dbInfo;
                    resolve();
                },
                function (t, error) {
                    reject(error);
                    return false;
                }
            );
        }, reject);
    });

    dbInfo.serializer = serializer;
    return dbInfoPromise;
}

function tryExecuteSql(
    t: SQLTransaction,
    dbInfo: DbInfo,
    sqlStatement: string,
    args: ObjectArray,
    callback: SQLStatementCallback,
    errorCallback: SQLStatementErrorCallback
) {
    t.executeSql(sqlStatement, args, callback, function (t, error) {
        if (error.code === error.SYNTAX_ERR) {
            t.executeSql(
                'SELECT name FROM sqlite_master ' + "WHERE type='table' AND name = ?",
                [dbInfo.storeName],
                function (t, results) {
                    if (!results.rows.length) {
                        // if the table is missing (was deleted)
                        // re-create it table and retry
                        createDbTable(
                            t,
                            dbInfo,
                            function () {
                                t.executeSql(sqlStatement, args, callback, errorCallback);
                            },
                            errorCallback
                        );
                    } else {
                        errorCallback(t, error);
                    }
                },
                errorCallback
            );
        } else {
            errorCallback(t, error);
        }
        return false;
    });
}

function getItem<T>(this: Module, key: string, callback?: Callback<T | null>) {
    const self = this;

    key = normalizeKey(key);

    const promise = new Promise<T | null>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const dbInfo = self._dbInfo;
                dbInfo.db!.transaction(function (t) {
                    tryExecuteSql(
                        t,
                        dbInfo,
                        `SELECT * FROM ${dbInfo.storeName} WHERE key = ? LIMIT 1`,
                        [key],
                        function (t, results) {
                            const sresult = results.rows.length
                                ? (results.rows.item(0).value as string)
                                : null;
                            let result: T | null = null;

                            // Check to see if this is serialized content we need to
                            // unpack.
                            if (sresult) {
                                result = dbInfo.serializer.deserialize(sresult) as T;
                            }

                            resolve(result);
                        },
                        function (t, error) {
                            reject(error);
                            return false;
                        }
                    );
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function iterate<T, U>(
    this: Module,
    iterator: DbIterator<T, U>,
    callback?: Callback<U | null | void>
) {
    const self = this;

    const promise = new Promise<U | void | null>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const dbInfo = self._dbInfo;

                dbInfo.db!.transaction(function (t) {
                    tryExecuteSql(
                        t,
                        dbInfo,
                        `SELECT * FROM ${dbInfo.storeName}`,
                        [],
                        function (t, results) {
                            const rows = results.rows;
                            const length = rows.length;

                            for (let i = 0; i < length; i++) {
                                const item = rows.item(i);
                                const sresult = item.value as string;
                                let oresult: T | null = null;
                                let result: U | null = null;

                                // Check to see if this is serialized content
                                // we need to unpack.
                                if (sresult) {
                                    oresult = dbInfo.serializer.deserialize(sresult) as T;
                                }

                                result = iterator(oresult, item.key, i + 1);

                                // void(0) prevents problems with redefinition
                                // of `undefined`.
                                if (result !== void 0) {
                                    resolve(result);
                                    return;
                                }
                            }

                            resolve();
                        },
                        function (t, error) {
                            reject(error);
                            return false;
                        }
                    );
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function _setItem<T>(
    this: Module,
    key: string,
    value: T | null,
    callback: Callback<T | null> | undefined,
    retriesLeft: number
) {
    const self = this;

    key = normalizeKey(key);

    const promise = new Promise<T | null>(function (resolve, reject) {
        self.ready()
            .then(function () {
                // The localStorage API doesn't return undefined values in an
                // "expected" way, so undefined is always cast to null in all
                // drivers. See: https://github.com/mozilla/localForage/pull/42
                if (value === undefined) {
                    value = null;
                }

                // Save the original value to pass to the callback.
                const originalValue = value;

                const dbInfo = self._dbInfo;
                dbInfo.serializer.serialize(value, function (value, error) {
                    if (error) {
                        reject(error);
                    } else {
                        dbInfo.db!.transaction(
                            function (t) {
                                tryExecuteSql(
                                    t,
                                    dbInfo,
                                    `INSERT OR REPLACE INTO ${dbInfo.storeName} ` +
                                        '(key, value) VALUES (?, ?)',
                                    [key, value],
                                    function () {
                                        resolve(originalValue);
                                    },
                                    function (t, error) {
                                        reject(error);
                                        return false;
                                    }
                                );
                            },
                            function (sqlError) {
                                // The transaction failed; check
                                // to see if it's a quota error.
                                if (sqlError.code === sqlError.QUOTA_ERR) {
                                    // We reject the callback outright for now, but
                                    // it's worth trying to re-run the transaction.
                                    // Even if the user accepts the prompt to use
                                    // more storage on Safari, this error will
                                    // be called.
                                    //
                                    // Try to re-run the transaction.
                                    if (retriesLeft > 0) {
                                        resolve(
                                            (_setItem<T>).apply(self, [
                                                key,
                                                originalValue,
                                                callback,
                                                retriesLeft - 1
                                            ])
                                        );
                                        return;
                                    }
                                    reject(sqlError);
                                }
                            }
                        );
                    }
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function setItem<T>(this: Module, key: string, value: T | null, callback?: Callback<T | null>) {
    return (_setItem<T>).apply(this, [key, value, callback, 1]);
}

function removeItem(this: Module, key: string, callback: Callback<void>) {
    const self = this;

    key = normalizeKey(key);

    const promise = new Promise<void>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const dbInfo = self._dbInfo;
                dbInfo.db!.transaction(function (t) {
                    tryExecuteSql(
                        t,
                        dbInfo,
                        `DELETE FROM ${dbInfo.storeName} WHERE key = ?`,
                        [key],
                        function () {
                            resolve();
                        },
                        function (t, error) {
                            reject(error);
                            return false;
                        }
                    );
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// Deletes every item in the table.
// TODO: Find out if this resets the AUTO_INCREMENT number.
function clear(this: Module, callback: Callback<void>) {
    const self = this;

    const promise = new Promise<void>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const dbInfo = self._dbInfo;
                dbInfo.db!.transaction(function (t) {
                    tryExecuteSql(
                        t,
                        dbInfo,
                        `DELETE FROM ${dbInfo.storeName}`,
                        [],
                        function () {
                            resolve();
                        },
                        function (t, error) {
                            reject(error);
                            return false;
                        }
                    );
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// Does a simple `COUNT(key)` to get the number of items stored in
// localForage.
function length(this: Module, callback?: Callback<number>) {
    const self = this;

    const promise = new Promise<number>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const dbInfo = self._dbInfo;
                dbInfo.db!.transaction(function (t) {
                    // Ahhh, SQL makes this one soooooo easy.
                    tryExecuteSql(
                        t,
                        dbInfo,
                        `SELECT COUNT(key) as c FROM ${dbInfo.storeName}`,
                        [],
                        function (t, results) {
                            const result = results.rows.item(0).c;
                            resolve(result);
                        },
                        function (t, error) {
                            reject(error);
                            return false;
                        }
                    );
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// Return the key located at key index X; essentially gets the key from a
// `WHERE id = ?`. This is the most efficient way I can think to implement
// this rarely-used (in my experience) part of the API, but it can seem
// inconsistent, because we do `INSERT OR REPLACE INTO` on `setItem()`, so
// the ID of each key will change every time it's updated. Perhaps a stored
// procedure for the `setItem()` SQL would solve this problem?
// TODO: Don't change ID on `setItem()`.
function key(this: Module, n: number, callback?: Callback<string | null>) {
    const self = this;

    const promise = new Promise<string | null>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const dbInfo = self._dbInfo;
                dbInfo.db!.transaction(function (t) {
                    tryExecuteSql(
                        t,
                        dbInfo,
                        `SELECT key FROM ${dbInfo.storeName} WHERE id = ? LIMIT 1`,
                        [n + 1],
                        function (t, results) {
                            const result = results.rows.length ? results.rows.item(0).key : null;
                            resolve(result);
                        },
                        function (t, error) {
                            reject(error);
                            return false;
                        }
                    );
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function keys(this: Module, callback?: Callback<string[]>) {
    const self = this;

    const promise = new Promise<string[]>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const dbInfo = self._dbInfo;
                dbInfo.db!.transaction(function (t) {
                    tryExecuteSql(
                        t,
                        dbInfo,
                        `SELECT key FROM ${dbInfo.storeName}`,
                        [],
                        function (t, results) {
                            const keys = [];

                            for (let i = 0; i < results.rows.length; i++) {
                                keys.push(results.rows.item(i).key);
                            }

                            resolve(keys);
                        },
                        function (t, error) {
                            reject(error);
                            return false;
                        }
                    );
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// https://www.w3.org/TR/webdatabase/#databases
// > There is no way to enumerate or delete the databases available for an origin from this API.
function getAllStoreNames(db: Database) {
    return new Promise<Names>(function (resolve, reject) {
        db.transaction(
            function (t) {
                t.executeSql(
                    'SELECT name FROM sqlite_master ' +
                        "WHERE type='table' AND name <> '__WebKitDatabaseInfoTable__'",
                    [],
                    function (t, results) {
                        const storeNames = [];

                        for (let i = 0; i < results.rows.length; i++) {
                            storeNames.push(results.rows.item(i).name);
                        }

                        resolve({
                            db,
                            storeNames
                        });
                    },
                    function (t, error) {
                        reject(error);
                        return false;
                    }
                );
            },
            function (sqlError) {
                reject(sqlError);
            }
        );
    });
}

function dropInstance(
    this: Module,
    _options?: Partial<InstanceOptions>,
    callback?: Callback<void>
) {
    callback = getCallback.apply(this, arguments as any);

    const currentConfig = this.config();
    _options = (typeof _options !== 'function' && _options) || {};
    if (!_options.name) {
        _options.name = _options.name || currentConfig.name;
        _options.storeName = _options.storeName || currentConfig.storeName;
    }
    const options: InstanceOptions = {
        name: _options.name,
        storeName: _options.storeName!
    };

    const self = this;
    let promise;
    if (!options.name) {
        promise = Promise.reject('Invalid arguments');
    } else {
        promise = new Promise<Names>(function (resolve) {
            let db: Database;
            if (options.name === currentConfig.name) {
                // use the db reference of the current instance
                db = self._dbInfo.db!;
            } else {
                db = openDatabase(options.name, '', '', 0);
            }

            if (!options.storeName) {
                // drop all database tables
                resolve(getAllStoreNames(db));
            } else {
                resolve({
                    db,
                    storeNames: [options.storeName]
                });
            }
        }).then(function (operationInfo) {
            return new Promise<void>(function (resolve, reject) {
                operationInfo.db.transaction(
                    function (t) {
                        function dropTable(storeName: string) {
                            return new Promise<void>(function (resolve, reject) {
                                t.executeSql(
                                    `DROP TABLE IF EXISTS ${storeName}`,
                                    [],
                                    function () {
                                        resolve();
                                    },
                                    function (t, error) {
                                        reject(error);
                                        return false;
                                    }
                                );
                            });
                        }

                        const operations = [];
                        for (let i = 0, len = operationInfo.storeNames.length; i < len; i++) {
                            operations.push(dropTable(operationInfo.storeNames[i]));
                        }

                        Promise.all(operations)
                            .then(function () {
                                resolve();
                            })
                            .catch(function (e) {
                                reject(e);
                            });
                    },
                    function (sqlError) {
                        reject(sqlError);
                    }
                );
            });
        });
    }

    executeCallback(promise, callback);
    return promise;
}

const webSQLStorage: Driver = {
    _driver: 'webSQLStorage',
    _initStorage: _initStorage,
    _support: isWebSQLValid(),
    iterate: iterate,
    getItem: getItem,
    setItem: setItem,
    removeItem: removeItem,
    clear: clear,
    length: length,
    key: key,
    keys: keys,
    dropInstance: dropInstance
};

export default webSQLStorage;
