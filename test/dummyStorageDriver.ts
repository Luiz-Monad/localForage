import { Callback, DbIterator, Driver, Forage, InstanceOptions, Options } from 'types';

interface Module extends Driver, Forage<DbInfo> {}

interface DbInfo extends Options {
    db: Record<string, string>;
}

const dummyStorage: Record<string, Record<string, string>> = {};

// Config the localStorage backend, using options set in the config.
function _initStorage(this: Module, options: Options) {
    const self = this;

    const dbInfo = {} as DbInfo;
    if (options) {
        for (const i in options) {
            (dbInfo as any)[i] = (options as any)[i];
        }
    }

    dummyStorage[dbInfo.name] = dbInfo.db = {};

    self._dbInfo = dbInfo;
    return Promise.resolve();
}

const SERIALIZED_MARKER = '__lfsc__:';
const SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;

// OMG the serializations!
const TYPE_ARRAYBUFFER = 'arbf';
const TYPE_BLOB = 'blob';
const TYPE_INT8ARRAY = 'si08';
const TYPE_UINT8ARRAY = 'ui08';
const TYPE_UINT8CLAMPEDARRAY = 'uic8';
const TYPE_INT16ARRAY = 'si16';
const TYPE_INT32ARRAY = 'si32';
const TYPE_UINT16ARRAY = 'ur16';
const TYPE_UINT32ARRAY = 'ui32';
const TYPE_FLOAT32ARRAY = 'fl32';
const TYPE_FLOAT64ARRAY = 'fl64';
const TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH + TYPE_ARRAYBUFFER.length;

function clear(this: Module, callback?: Callback<void>) {
    const self = this;
    const promise = new Promise<void>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const db = self._dbInfo.db;

                for (const key in db) {
                    if (db.hasOwnProperty(key)) {
                        delete db[key];
                        // db[key] = undefined;
                    }
                }

                resolve();
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function getItem<T>(this: Module, key: string, callback?: Callback<T | null>) {
    const self = this;

    // Cast the key to a string, as that's all we can set as a key.
    if (typeof key !== 'string') {
        window.console.warn(key + ' used as a key, but it is not a string.');
        key = String(key);
    }

    const promise = new Promise<T | null>(function (resolve, reject) {
        self.ready()
            .then(function () {
                try {
                    const db = self._dbInfo.db;
                    const sresult = db[key];
                    let result: T | null = null;

                    if (sresult) {
                        result = _deserialize(sresult) as T;
                    }

                    resolve(result);
                } catch (e) {
                    reject(e);
                }
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
    let iterationNumber = 1;

    const promise = new Promise<U | null | void>(function (resolve, reject) {
        self.ready()
            .then(function () {
                try {
                    const db = self._dbInfo.db;

                    for (const key in db) {
                        const sresult = db[key];
                        let result: T | null = null;

                        if (sresult) {
                            result = _deserialize(sresult) as T;
                        }

                        resolve(iterator(result, key, iterationNumber++));
                    }

                    resolve();
                } catch (e) {
                    reject(e);
                }
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function key(this: Module, n: number, callback?: Callback<string | null>) {
    const self = this;
    const promise = new Promise<string | null>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const db = self._dbInfo.db;
                let result: string | null = null;
                let index = 0;

                for (const key in db) {
                    if (db.hasOwnProperty(key) && db[key] !== undefined) {
                        if (n === index) {
                            result = key;
                            break;
                        }
                        index++;
                    }
                }

                resolve(result);
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
                const db = self._dbInfo.db;
                const keys: string[] = [];

                for (const key in db) {
                    if (db.hasOwnProperty(key)) {
                        keys.push(key);
                    }
                }

                resolve(keys);
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function length(this: Module, callback?: Callback<number>) {
    const self = this;
    const promise = new Promise<number>(function (resolve, reject) {
        self.keys()
            .then(function (keys) {
                resolve(keys.length);
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function removeItem(this: Module, key: string, callback: Callback<void>) {
    const self = this;

    // Cast the key to a string, as that's all we can set as a key.
    if (typeof key !== 'string') {
        window.console.warn(key + ' used as a key, but it is not a string.');
        key = String(key);
    }

    const promise = new Promise<void>(function (resolve, reject) {
        self.ready()
            .then(function () {
                const db = self._dbInfo.db;
                if (db.hasOwnProperty(key)) {
                    delete db[key];
                    // db[key] = undefined;
                }

                resolve();
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function setItem<T>(this: Module, key: string, value: T | null, callback: Callback<T | null>) {
    const self = this;

    // Cast the key to a string, as that's all we can set as a key.
    if (typeof key !== 'string') {
        window.console.warn(key + ' used as a key, but it is not a string.');
        key = String(key);
    }

    const promise = new Promise<T | null>(function (resolve, reject) {
        self.ready()
            .then(function () {
                // Convert undefined values to null.
                // https://github.com/mozilla/localForage/pull/42
                if (value === undefined) {
                    value = null;
                }

                // Save the original value to pass to the callback.
                const originalValue = value;

                _serialize(value, function (value, error) {
                    if (error) {
                        reject(error);
                    } else {
                        try {
                            const db = self._dbInfo.db;
                            db[key] = value as string;
                            resolve(originalValue);
                        } catch (e) {
                            reject(e);
                        }
                    }
                });
            })
            .catch(reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// _serialize just like in LocalStorage
function _serialize<T>(
    value: ArrayBufferView | ArrayBuffer | Blob | T | null,
    callback: (onDone: string | Error | null, onError?: unknown) => void
) {
    let valueString = '';
    if (value) {
        valueString = value.toString();
    }

    // Cannot use `value instanceof ArrayBuffer` or such here, as these
    // checks fail when running the tests using casper.js...
    //
    // TODO: See why those tests fail and use a better solution.
    if (
        value &&
        (value.toString() === '[object ArrayBuffer]' ||
            ((value as Partial<ArrayBufferView>).buffer &&
                (value as ArrayBufferView).buffer.toString() === '[object ArrayBuffer]'))
    ) {
        const arrayBuffer = value as ArrayBufferView & ArrayBuffer;

        // Convert binary arrays to a string and prefix the string with
        // a special marker.
        let buffer;
        let marker = SERIALIZED_MARKER;

        if (value instanceof ArrayBuffer) {
            buffer = value;
            marker += TYPE_ARRAYBUFFER;
        } else {
            buffer = arrayBuffer.buffer;

            if (valueString === '[object Int8Array]') {
                marker += TYPE_INT8ARRAY;
            } else if (valueString === '[object Uint8Array]') {
                marker += TYPE_UINT8ARRAY;
            } else if (valueString === '[object Uint8ClampedArray]') {
                marker += TYPE_UINT8CLAMPEDARRAY;
            } else if (valueString === '[object Int16Array]') {
                marker += TYPE_INT16ARRAY;
            } else if (valueString === '[object Uint16Array]') {
                marker += TYPE_UINT16ARRAY;
            } else if (valueString === '[object Int32Array]') {
                marker += TYPE_INT32ARRAY;
            } else if (valueString === '[object Uint32Array]') {
                marker += TYPE_UINT32ARRAY;
            } else if (valueString === '[object Float32Array]') {
                marker += TYPE_FLOAT32ARRAY;
            } else if (valueString === '[object Float64Array]') {
                marker += TYPE_FLOAT64ARRAY;
            } else {
                callback(new Error('Failed to get type for BinaryArray'));
            }
        }

        callback(marker + _bufferToString(buffer));
    } else if (valueString === '[object Blob]') {
        const blobValue = value as Blob;

        // Conver the blob to a binaryArray and then to a string.
        const fileReader = new FileReader();

        fileReader.onload = function () {
            const str = _bufferToString(this.result as ArrayBuffer);

            callback(SERIALIZED_MARKER + TYPE_BLOB + str);
        };

        fileReader.readAsArrayBuffer(blobValue);
    } else {
        try {
            callback(JSON.stringify(value));
        } catch (e: any) {
            window.console.error("Couldn't convert value into a JSON " + 'string: ', value);

            callback(e);
        }
    }
}

// _deserialize just like in LocalStorage
function _deserialize<T>(value: string): ArrayBuffer | Blob | T {
    // If we haven't marked this string as being specially serialized (i.e.
    // something other than serialized JSON), we can just return it and be
    // done with it.
    if (value.substring(0, SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
        return JSON.parse(value);
    }

    // The following code deals with deserializing some kind of Blob or
    // TypedArray. First we separate out the type of data we're dealing
    // with from the data itself.
    const serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
    const type = value.substring(SERIALIZED_MARKER_LENGTH, TYPE_SERIALIZED_MARKER_LENGTH);

    // Fill the string into a ArrayBuffer.
    // 2 bytes for each char.
    const buffer = new ArrayBuffer(serializedString.length * 2);
    const bufferView = new Uint16Array(buffer);
    for (let i = serializedString.length - 1; i >= 0; i--) {
        bufferView[i] = serializedString.charCodeAt(i);
    }

    // Return the right type based on the code/type set during
    // serialization.
    switch (type) {
        case TYPE_ARRAYBUFFER:
            return buffer;
        case TYPE_BLOB:
            return new Blob([buffer]);
        case TYPE_INT8ARRAY:
            return new Int8Array(buffer);
        case TYPE_UINT8ARRAY:
            return new Uint8Array(buffer);
        case TYPE_UINT8CLAMPEDARRAY:
            return new Uint8ClampedArray(buffer);
        case TYPE_INT16ARRAY:
            return new Int16Array(buffer);
        case TYPE_UINT16ARRAY:
            return new Uint16Array(buffer);
        case TYPE_INT32ARRAY:
            return new Int32Array(buffer);
        case TYPE_UINT32ARRAY:
            return new Uint32Array(buffer);
        case TYPE_FLOAT32ARRAY:
            return new Float32Array(buffer);
        case TYPE_FLOAT64ARRAY:
            return new Float64Array(buffer);
        default:
            throw new Error('Unkown type: ' + type);
    }
}

// _bufferToString just like in LocalStorage
function _bufferToString(buffer: ArrayBuffer) {
    let str = '';
    const uint16Array = new Uint16Array(buffer);

    try {
        str = String.fromCharCode.apply(null, uint16Array as any);
    } catch (e) {
        // This is a fallback implementation in case the first one does
        // not work. This is required to get the phantomjs passing...
        for (let i = 0; i < uint16Array.length; i++) {
            str += String.fromCharCode(uint16Array[i]);
        }
    }

    return str;
}

function executeCallback<T>(promise: Promise<T>, callback?: Callback<T>) {
    if (callback) {
        promise.then(
            function (result) {
                callback(null, result);
            },
            function (error) {
                // eslint-disable-next-line @typescript-eslint/ban-types
                (callback as Function)(error);
            }
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function dropInstance(this: Module, _options: Partial<InstanceOptions>, callback?: Callback<void>) {
    return new Promise<void>(() => {});
}

const dummyStorageDriver: Driver = {
    _driver: 'dummyStorageDriver',
    _initStorage: _initStorage,
    _support: true,
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

export default dummyStorageDriver;
