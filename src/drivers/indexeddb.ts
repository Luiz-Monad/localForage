import isIndexedDBValid from '../utils/isIndexedDBValid';
import createBlob from '../utils/createBlob';
import idb from '../utils/idb';
import Promise from '../utils/promise';
import executeCallback from '../utils/executeCallback';
import executeTwoCallbacks from '../utils/executeTwoCallbacks';
import normalizeKey from '../utils/normalizeKey';
import getCallback from '../utils/getCallback';
import {
    Callback,
    DbIterator,
    Driver,
    Forage,
    InstanceOptions,
    ResultCallback,
    Options
} from '../types';

export interface Module extends Driver, Forage<DbInfo> {
    _initReady?: () => Promise<void>;
}

interface DbInfo extends Options {
    db: IDBDatabase | null;
    version: number;
}

interface Context {
    deferredOperations: Defer[];
    db: IDBDatabase | null;
    dbReady: Promise<void> | null;
    forages: Module[];
}

interface Defer {
    promise: Promise<void>;
    reject: (reason?: any) => void;
    resolve: () => void;
}

interface EncodedBlob {
    __local_forage_encoded_blob: boolean;
    data: string;
    type: string;
}

// Some code originally from async_storage.js in
// [Gaia](https://github.com/mozilla-b2g/gaia).

const DETECT_BLOB_SUPPORT_STORE = 'local-forage-detect-blob-support';
let supportsBlobs: unknown;
const dbContexts: Record<string, Context> = {};
const toString = Object.prototype.toString;

// Transaction Modes
const READ_ONLY = 'readonly';
const READ_WRITE = 'readwrite';

// Transform a binary string to an array buffer, because otherwise
// weird stuff happens when you try to work with the binary string directly.
// It is known.
// From http://stackoverflow.com/questions/14967647/ (continues on next line)
// encode-decode-image-with-base64-breaks-image (2013-04-21)
function _binStringToArrayBuffer(bin: string) {
    const length = bin.length;
    const buf = new ArrayBuffer(length);
    const arr = new Uint8Array(buf);
    for (let i = 0; i < length; i++) {
        arr[i] = bin.charCodeAt(i);
    }
    return buf;
}

//
// Blobs are not supported in all versions of IndexedDB, notably
// Chrome <37 and Android <5. In those versions, storing a blob will throw.
//
// Various other blob bugs exist in Chrome v37-42 (inclusive).
// Detecting them is expensive and confusing to users, and Chrome 37-42
// is at very low usage worldwide, so we do a hacky userAgent check instead.
//
// content-type bug: https://code.google.com/p/chromium/issues/detail?id=408120
// 404 bug: https://code.google.com/p/chromium/issues/detail?id=447916
// FileReader bug: https://code.google.com/p/chromium/issues/detail?id=447836
//
// Code borrowed from PouchDB. See:
// https://github.com/pouchdb/pouchdb/blob/master/packages/node_modules/pouchdb-adapter-idb/src/blobSupport.js
//
function _checkBlobSupportWithoutCaching(idb: IDBDatabase) {
    return new Promise(function (resolve) {
        const txn = idb.transaction(DETECT_BLOB_SUPPORT_STORE, READ_WRITE);
        const blob = createBlob(['']);
        txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');

        txn.onabort = function (e) {
            // If the transaction aborts now its due to not being able to
            // write to the database, likely due to the disk being full
            e.preventDefault();
            e.stopPropagation();
            resolve(false);
        };

        txn.oncomplete = function () {
            const matchedChrome = navigator.userAgent.match(/Chrome\/(\d+)/);
            const matchedEdge = navigator.userAgent.match(/Edge\//);
            // MS Edge pretends to be Chrome 42:
            // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
            resolve(matchedEdge || !matchedChrome || parseInt(matchedChrome[1], 10) >= 43);
        };
    }).catch(function () {
        return false; // error, so assume unsupported
    });
}

function _checkBlobSupport(idb: IDBDatabase) {
    if (typeof supportsBlobs === 'boolean') {
        return Promise.resolve(supportsBlobs);
    }
    return _checkBlobSupportWithoutCaching(idb).then(function (value) {
        supportsBlobs = value;
        return supportsBlobs;
    });
}

function _deferReadiness(dbInfo: DbInfo) {
    const dbContext = dbContexts[dbInfo.name];

    // Create a deferred object representing the current database operation.
    const deferredOperation = {} as Defer;

    deferredOperation.promise = new Promise(function (resolve, reject) {
        deferredOperation.resolve = resolve;
        deferredOperation.reject = reject;
    });

    // Enqueue the deferred operation.
    dbContext.deferredOperations.push(deferredOperation);

    // Chain its promise to the database readiness.
    if (!dbContext.dbReady) {
        dbContext.dbReady = deferredOperation.promise;
    } else {
        dbContext.dbReady = dbContext.dbReady.then(function () {
            return deferredOperation.promise;
        });
    }
}

function _advanceReadiness(dbInfo: DbInfo) {
    const dbContext = dbContexts[dbInfo.name];

    // Dequeue a deferred operation.
    const deferredOperation = dbContext.deferredOperations.pop();

    // Resolve its promise (which is part of the database readiness
    // chain of promises).
    if (deferredOperation) {
        deferredOperation.resolve();
        return deferredOperation.promise;
    }
}

function _rejectReadiness(dbInfo: DbInfo, err: any) {
    const dbContext = dbContexts[dbInfo.name];

    // Dequeue a deferred operation.
    const deferredOperation = dbContext.deferredOperations.pop();

    // Reject its promise (which is part of the database readiness
    // chain of promises).
    if (deferredOperation) {
        deferredOperation.reject(err);
        return deferredOperation.promise;
    }
}

function _getConnection(dbInfo: DbInfo, upgradeNeeded: boolean) {
    return new Promise<IDBDatabase>(function (resolve, reject) {
        dbContexts[dbInfo.name] = dbContexts[dbInfo.name] || createDbContext();

        if (dbInfo.db) {
            if (upgradeNeeded) {
                _deferReadiness(dbInfo);
                dbInfo.db.close();
            } else {
                return resolve(dbInfo.db);
            }
        }

        const dbArgs: [string, number?] = [dbInfo.name];

        if (upgradeNeeded) {
            dbArgs.push(dbInfo.version);
        }

        const openreq = idb.open.apply(idb, dbArgs);

        if (upgradeNeeded) {
            openreq.onupgradeneeded = function (e) {
                const db = openreq.result;
                try {
                    db.createObjectStore(dbInfo.storeName);
                    if (e.oldVersion <= 1) {
                        // Added when support for blob shims was added
                        db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
                    }
                } catch (ex: any) {
                    if (ex.name === 'ConstraintError') {
                        console.warn(
                            'The database "' +
                                dbInfo.name +
                                '"' +
                                ' has been upgraded from version ' +
                                e.oldVersion +
                                ' to version ' +
                                e.newVersion +
                                ', but the storage "' +
                                dbInfo.storeName +
                                '" already exists.'
                        );
                    } else {
                        throw ex;
                    }
                }
            };
        }

        openreq.onerror = function (e) {
            e.preventDefault();
            reject(openreq.error);
        };

        openreq.onsuccess = function () {
            const db = openreq.result;
            db.onversionchange = function (e) {
                // Triggered when the database is modified (e.g. adding an objectStore) or
                // deleted (even when initiated by other sessions in different tabs).
                // Closing the connection here prevents those operations from being blocked.
                // If the database is accessed again later by this instance, the connection
                // will be reopened or the database recreated as needed.
                (e.target as any).close();
            };
            resolve(db);
            _advanceReadiness(dbInfo);
        };
    });
}

function _getOriginalConnection(dbInfo: DbInfo) {
    return _getConnection(dbInfo, false);
}

function _getUpgradedConnection(dbInfo: DbInfo) {
    return _getConnection(dbInfo, true);
}

function _isUpgradeNeeded(dbInfo: DbInfo, defaultVersion?: number) {
    if (!dbInfo.db) {
        return true;
    }

    const isNewStore = !dbInfo.db.objectStoreNames.contains(dbInfo.storeName);
    const isDowngrade = dbInfo.version < dbInfo.db.version;
    const isUpgrade = dbInfo.version > dbInfo.db.version;

    if (isDowngrade) {
        // If the version is not the default one
        // then warn for impossible downgrade.
        if (dbInfo.version !== defaultVersion) {
            console.warn(
                'The database "' +
                    dbInfo.name +
                    '"' +
                    " can't be downgraded from version " +
                    dbInfo.db.version +
                    ' to version ' +
                    dbInfo.version +
                    '.'
            );
        }
        // Align the versions to prevent errors.
        dbInfo.version = dbInfo.db.version;
    }

    if (isUpgrade || isNewStore) {
        // If the store is new then increment the version (if needed).
        // This will trigger an "upgradeneeded" event which is required
        // for creating a store.
        if (isNewStore) {
            const incVersion = dbInfo.db.version + 1;
            if (incVersion > dbInfo.version) {
                dbInfo.version = incVersion;
            }
        }

        return true;
    }

    return false;
}

// encode a blob for indexeddb engines that don't support blobs
function _encodeBlob(blob: Blob) {
    return new Promise<EncodedBlob>(function (resolve, reject) {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onloadend = function (e) {
            const base64 = btoa((e.target?.result || '') as string);
            resolve({
                __local_forage_encoded_blob: true,
                data: base64,
                type: blob.type
            });
        };
        reader.readAsBinaryString(blob);
    });
}

// decode an encoded blob
function _decodeBlob(encodedBlob: EncodedBlob) {
    const arrayBuff = _binStringToArrayBuffer(atob(encodedBlob.data));
    return createBlob([arrayBuff], { type: encodedBlob.type });
}

// is this one of our fancy encoded blobs?
function _isEncodedBlob(value?: EncodedBlob) {
    return value && value.__local_forage_encoded_blob;
}

// Specialize the default `ready()` function by making it dependent
// on the current database operations. Thus, the driver will be actually
// ready when it's been initialized (default) *and* there are no pending
// operations on the database (initiated by some other instances).
function _fullyReady(this: Module, callback?: ResultCallback<void>): Promise<void> {
    const self = this;

    const promise = self._initReady!().then(function () {
        const dbContext = dbContexts[self._dbInfo.name];

        if (dbContext && dbContext.dbReady) {
            return dbContext.dbReady;
        }
    });

    executeTwoCallbacks(promise, callback, callback as any);
    return promise;
}

// Try to establish a new db connection to replace the
// current one which is broken (i.e. experiencing
// InvalidStateError while creating a transaction).
function _tryReconnect(dbInfo: DbInfo) {
    _deferReadiness(dbInfo);

    const dbContext = dbContexts[dbInfo.name];
    const forages = dbContext.forages;

    for (let i = 0; i < forages.length; i++) {
        const forage = forages[i];
        if (forage._dbInfo.db) {
            forage._dbInfo.db.close();
            forage._dbInfo.db = null;
        }
    }
    dbInfo.db = null;

    return _getOriginalConnection(dbInfo)
        .then((db) => {
            dbInfo.db = db;
            if (_isUpgradeNeeded(dbInfo)) {
                // Reopen the database for upgrading.
                return _getUpgradedConnection(dbInfo);
            }
            return db;
        })
        .then((db) => {
            // store the latest db reference
            // in case the db was upgraded
            dbInfo.db = dbContext.db = db;
            for (let i = 0; i < forages.length; i++) {
                forages[i]._dbInfo.db = db;
            }
        })
        .catch((err) => {
            _rejectReadiness(dbInfo, err);
            throw err;
        });
}

// FF doesn't like Promises (micro-tasks) and IDDB store operations,
// so we have to do it with callbacks
function createTransaction(
    dbInfo: DbInfo,
    mode: IDBTransactionMode,
    callback: (error: any, result?: IDBTransaction) => void,
    retries?: number
) {
    if (retries === undefined) {
        retries = 1;
    }

    try {
        const tx = dbInfo.db!.transaction(dbInfo.storeName, mode);
        callback(null, tx);
    } catch (err: any) {
        if (
            retries > 0 &&
            (!dbInfo.db || err.name === 'InvalidStateError' || err.name === 'NotFoundError')
        ) {
            return Promise.resolve()
                .then(() => {
                    if (
                        !dbInfo.db ||
                        (err.name === 'NotFoundError' &&
                            !dbInfo.db.objectStoreNames.contains(dbInfo.storeName) &&
                            dbInfo.version <= dbInfo.db.version)
                    ) {
                        // increase the db version, to create the new ObjectStore
                        if (dbInfo.db) {
                            dbInfo.version = dbInfo.db.version + 1;
                        }
                        // Reopen the database for upgrading.
                        return _getUpgradedConnection(dbInfo);
                    }
                })
                .then(() => {
                    return _tryReconnect(dbInfo).then(function () {
                        createTransaction(dbInfo, mode, callback, retries! - 1);
                    });
                })
                .catch(callback);
        }

        callback(err);
    }
}

function createDbContext(): Context {
    return {
        // Running localForages sharing a database.
        forages: [],
        // Shared database.
        db: null,
        // Database readiness (promise).
        dbReady: null,
        // Deferred operations on the database.
        deferredOperations: []
    };
}

// Open the IndexedDB database (automatically creates one if one didn't
// previously exist), using any options set in the config.
function _initStorage(this: Module, options: Options) {
    const self = this;
    const dbInfo = {
        db: null
    } as DbInfo;

    if (options) {
        for (const i in options) {
            (dbInfo as any)[i] = (options as any)[i];
        }
    }

    // Get the current context of the database;
    let dbContext = dbContexts[dbInfo.name];

    // ...or create a new context.
    if (!dbContext) {
        dbContext = createDbContext();
        // Register the new context in the global container.
        dbContexts[dbInfo.name] = dbContext;
    }

    // Register itself as a running localForage in the current context.
    dbContext.forages.push(self);

    // Replace the default `ready()` function with the specialized one.
    if (!self._initReady) {
        self._initReady = self.ready;
        self.ready = _fullyReady;
    }

    // Create an array of initialization states of the related localForages.
    const initPromises = [];

    function ignoreErrors() {
        // Don't handle errors here,
        // just makes sure related localForages aren't pending.
        return Promise.resolve();
    }

    for (let j = 0; j < dbContext.forages.length; j++) {
        const forage = dbContext.forages[j];
        if (forage !== self) {
            // Don't wait for itself...
            initPromises.push(forage._initReady!().catch(ignoreErrors));
        }
    }

    // Take a snapshot of the related localForages.
    const forages = dbContext.forages.slice(0);

    // Initialize the connection process only when
    // all the related localForages aren't pending.
    return Promise.all(initPromises)
        .then(function () {
            dbInfo.db = dbContext.db;
            // Get the connection or open a new one without upgrade.
            return _getOriginalConnection(dbInfo);
        })
        .then(function (db) {
            dbInfo.db = db;
            if (_isUpgradeNeeded(dbInfo, self._defaultConfig.version)) {
                // Reopen the database for upgrading.
                return _getUpgradedConnection(dbInfo);
            }
            return db;
        })
        .then(function (db) {
            dbInfo.db = dbContext.db = db;
            self._dbInfo = dbInfo;
            // Share the final connection amongst related localForages.
            for (let k = 0; k < forages.length; k++) {
                const forage = forages[k];
                if (forage !== self) {
                    // Self is already up-to-date.
                    forage._dbInfo.db = dbInfo.db;
                    forage._dbInfo.version = dbInfo.version;
                }
            }
        });
}

function getItem<T>(this: Module, key: string, callback?: Callback<T | null>) {
    const self = this;

    key = normalizeKey(key);

    const promise = new Promise<T | null>(function (resolve, reject) {
        self.ready()
            .then(function () {
                createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                    if (err) {
                        return reject(err);
                    }

                    try {
                        const store = transaction!.objectStore(self._dbInfo.storeName);
                        const req = store.get(key);

                        req.onsuccess = function () {
                            let value = req.result;
                            if (value === undefined) {
                                value = null;
                            }
                            if (_isEncodedBlob(value)) {
                                value = _decodeBlob(value);
                            }
                            resolve(value);
                        };

                        req.onerror = function () {
                            reject(req.error);
                        };
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// Iterate over all items stored in database.
function iterate<T, U>(
    this: Module,
    iterator: DbIterator<T, U>,
    callback?: Callback<U | null | void>
) {
    const self = this;

    const promise = new Promise<U | null | void>(function (resolve, reject) {
        self.ready()
            .then(function () {
                createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                    if (err) {
                        return reject(err);
                    }

                    try {
                        const store = transaction!.objectStore(self._dbInfo.storeName);
                        const req = store.openCursor();
                        let iterationNumber = 1;

                        req.onsuccess = function () {
                            const cursor = req.result;

                            if (cursor) {
                                let value = cursor.value;
                                if (_isEncodedBlob(value)) {
                                    value = _decodeBlob(value);
                                }
                                const result = iterator(
                                    value,
                                    cursor.key as string,
                                    iterationNumber++
                                );

                                // when the iterator callback returns any
                                // (non-`undefined`) value, then we stop
                                // the iteration immediately
                                if (result !== void 0) {
                                    resolve(result);
                                } else {
                                    cursor.continue();
                                }
                            } else {
                                resolve();
                            }
                        };

                        req.onerror = function () {
                            reject(req.error);
                        };
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);

    return promise;
}

type ObjectLike<T> = T | Blob | EncodedBlob | null;

function setItem<T>(this: Module, key: string, value: T | null, callback?: Callback<T | null>) {
    const self = this;

    key = normalizeKey(key);

    const promise = new Promise<T | null>(function (resolve, reject) {
        let dbInfo;
        self.ready()
            .then(function () {
                dbInfo = self._dbInfo;
                if (toString.call(value) === '[object Blob]') {
                    const blobValue = value as Blob;
                    return _checkBlobSupport(dbInfo.db!).then<ObjectLike<T>>(
                        function (blobSupport) {
                            if (blobSupport) {
                                return blobValue;
                            }
                            return _encodeBlob(blobValue);
                        }
                    );
                }
                return value;
            })
            .then(function (value) {
                createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
                    if (err || !transaction) {
                        return reject(err);
                    }

                    try {
                        const store = transaction.objectStore(self._dbInfo.storeName);

                        // The reason we don't _save_ null is because IE 10 does
                        // not support saving the `null` type in IndexedDB. How
                        // ironic, given the bug below!
                        // See: https://github.com/mozilla/localForage/issues/161
                        if (value === null) {
                            value = undefined!;
                        }

                        const req = store.put(value, key);

                        transaction.oncomplete = function () {
                            // Cast to undefined so the value passed to
                            // callback/promise is the same as what one would get out
                            // of `getItem()` later. This leads to some weirdness
                            // (setItem('foo', undefined) will return `null`), but
                            // it's not my fault localStorage is our baseline and that
                            // it's weird.
                            if (value === undefined) {
                                value = null;
                            }

                            resolve(value as T);
                        };
                        transaction.onabort = transaction.onerror = function () {
                            const err = req.error ? req.error : req.transaction?.error;
                            reject(err);
                        };
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function removeItem(this: Module, key: string, callback: Callback<void>) {
    const self = this;

    key = normalizeKey(key);

    const promise = new Promise<void>(function (resolve, reject) {
        self.ready()
            .then(function () {
                createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
                    if (err || !transaction) {
                        return reject(err);
                    }

                    try {
                        const store = transaction.objectStore(self._dbInfo.storeName);
                        // We use a Grunt task to make this safe for IE and some
                        // versions of Android (including those used by Cordova).
                        // Normally IE won't like `.delete()` and will insist on
                        // using `['delete']()`, but we have a build step that
                        // fixes this for us now.
                        const req = store.delete(key);
                        transaction.oncomplete = function () {
                            resolve();
                        };

                        transaction.onerror = function () {
                            reject(req.error);
                        };

                        // The request will be also be aborted if we've exceeded our storage
                        // space.
                        transaction.onabort = function () {
                            const err = req.error ? req.error : req.transaction?.error;
                            reject(err);
                        };
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function clear(this: Module, callback: Callback<void>) {
    const self = this;

    const promise = new Promise<void>(function (resolve, reject) {
        self.ready()
            .then(function () {
                createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
                    if (err || !transaction) {
                        return reject(err);
                    }

                    try {
                        const store = transaction.objectStore(self._dbInfo.storeName);
                        const req = store.clear();

                        transaction.oncomplete = function () {
                            resolve();
                        };

                        transaction.onabort = transaction.onerror = function () {
                            const err = req.error ? req.error : req.transaction?.error;
                            reject(err);
                        };
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function length(this: Module, callback?: Callback<number>) {
    const self = this;

    const promise = new Promise<number>(function (resolve, reject) {
        self.ready()
            .then(function () {
                createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                    if (err) {
                        return reject(err);
                    }

                    try {
                        const store = transaction!.objectStore(self._dbInfo.storeName);
                        const req = store.count();

                        req.onsuccess = function () {
                            resolve(req.result);
                        };

                        req.onerror = function () {
                            reject(req.error);
                        };
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function key(this: Module, n: number, callback?: Callback<string | null>) {
    const self = this;

    const promise = new Promise<string | null>(function (resolve, reject) {
        if (n < 0) {
            resolve(null);

            return;
        }

        self.ready()
            .then(function () {
                createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                    if (err) {
                        return reject(err);
                    }

                    try {
                        const store = transaction!.objectStore(self._dbInfo.storeName);
                        const req = store.openKeyCursor();
                        let advanced = false;

                        req.onsuccess = function () {
                            const cursor = req.result;
                            if (!cursor) {
                                // this means there weren't enough keys
                                resolve(null);

                                return;
                            }

                            if (n === 0) {
                                // We have the first key, return it if that's what they
                                // wanted.
                                resolve(cursor.key as string);
                            } else {
                                if (!advanced) {
                                    // Otherwise, ask the cursor to skip ahead n
                                    // records.
                                    advanced = true;
                                    cursor.advance(n);
                                } else {
                                    // When we get here, we've got the nth key.
                                    resolve(cursor.key as string);
                                }
                            }
                        };

                        req.onerror = function () {
                            reject(req.error);
                        };
                    } catch (e) {
                        reject(e);
                    }
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
                createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                    if (err) {
                        return reject(err);
                    }

                    try {
                        const store = transaction!.objectStore(self._dbInfo.storeName);
                        const req = store.openKeyCursor();
                        const keys: string[] = [];

                        req.onsuccess = function () {
                            const cursor = req.result;

                            if (!cursor) {
                                resolve(keys);
                                return;
                            }

                            keys.push(cursor.key as string);
                            cursor.continue();
                        };

                        req.onerror = function () {
                            reject(req.error);
                        };
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
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
    const options: DbInfo = {
        name: _options.name,
        storeName: _options.storeName!,
        db: null,
        version: 0
    };

    const self = this;
    let promise;
    if (!options.name) {
        promise = Promise.reject('Invalid arguments');
    } else {
        const isCurrentDb = options.name === currentConfig.name && self._dbInfo.db;

        const dbPromise = isCurrentDb
            ? Promise.resolve(self._dbInfo.db!)
            : _getOriginalConnection(options).then((db) => {
                  const dbContext = dbContexts[options.name];
                  const forages = dbContext.forages;
                  dbContext.db = db;
                  for (let i = 0; i < forages.length; i++) {
                      forages[i]._dbInfo.db = db;
                  }
                  return db;
              });

        if (!options.storeName) {
            promise = dbPromise.then((db) => {
                _deferReadiness(options);

                const dbContext = dbContexts[options.name];
                const forages = dbContext.forages;

                db.close();
                for (let i = 0; i < forages.length; i++) {
                    const forage = forages[i];
                    forage._dbInfo.db = null;
                }

                const dropDBPromise = new Promise<IDBDatabase>((resolve, reject) => {
                    const req = idb.deleteDatabase(options.name);

                    req.onerror = () => {
                        const db = req.result;
                        if (db) {
                            db.close();
                        }
                        reject(req.error);
                    };

                    req.onblocked = () => {
                        // Closing all open connections in onversionchange handler should prevent this situation, but if
                        // we do get here, it just means the request remains pending - eventually it will succeed or error
                        console.warn(
                            'dropInstance blocked for database "' +
                                options.name +
                                '" until all open connections are closed'
                        );
                    };

                    req.onsuccess = () => {
                        const db = req.result;
                        if (db) {
                            db.close();
                        }
                        resolve(db);
                    };
                });

                return dropDBPromise
                    .then((db) => {
                        dbContext.db = db;
                        for (let i = 0; i < forages.length; i++) {
                            const forage = forages[i];
                            _advanceReadiness(forage._dbInfo);
                        }
                    })
                    .catch((err) => {
                        (_rejectReadiness(options, err) || Promise.resolve()).catch(() => {});
                        throw err;
                    });
            });
        } else {
            promise = dbPromise.then((db) => {
                if (!db.objectStoreNames.contains(options.storeName)) {
                    return;
                }

                const newVersion = db.version + 1;

                _deferReadiness(options);

                const dbContext = dbContexts[options.name];
                const forages = dbContext.forages;

                db.close();
                for (let i = 0; i < forages.length; i++) {
                    const forage = forages[i];
                    forage._dbInfo.db = null;
                    forage._dbInfo.version = newVersion;
                }

                const dropObjectPromise = new Promise<IDBDatabase>((resolve, reject) => {
                    const req = idb.open(options.name, newVersion);

                    req.onerror = () => {
                        const db = req.result;
                        db.close();
                        reject(req.error);
                    };

                    req.onupgradeneeded = () => {
                        const db = req.result;
                        db.deleteObjectStore(options.storeName);
                    };

                    req.onsuccess = () => {
                        const db = req.result;
                        db.close();
                        resolve(db);
                    };
                });

                return dropObjectPromise
                    .then((db) => {
                        dbContext.db = db;
                        for (let j = 0; j < forages.length; j++) {
                            const forage = forages[j];
                            forage._dbInfo.db = db;
                            _advanceReadiness(forage._dbInfo);
                        }
                    })
                    .catch((err) => {
                        (_rejectReadiness(options, err) || Promise.resolve()).catch(() => {});
                        throw err;
                    });
            });
        }
    }

    executeCallback(promise, callback);
    return promise;
}

const asyncStorage: Driver = {
    _driver: 'asyncStorage',
    _initStorage: _initStorage,
    _support: isIndexedDBValid(),
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

export default asyncStorage;
