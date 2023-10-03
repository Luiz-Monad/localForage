import serializer from './utils/serializer';
export interface InstanceOptions {
    name: string;
    storeName: string;
}
export interface Options extends InstanceOptions {
    driver?: string | string[] | null;
    size?: number;
    version?: number;
    description?: string;
}
export type ResultCallback<T> = (value: T) => void;
export type ErrorCallback = (err: Error | null) => void;
export type Callback<T> = (err: Error | null, value: T) => void;
export type DbIterator<T, U> = (result: T | null, value: string, iterationNumber: number) => U | null;
export interface MethodsCore {
    getItem<T>(key: string, callback?: Callback<T | null>): Promise<T | null>;
    setItem<T>(key: string, value: T | null, callback?: Callback<T | null>): Promise<T | null>;
    removeItem(key: string, callback?: Callback<void>): Promise<void>;
    clear(callback?: Callback<void>): Promise<void>;
    length(callback?: Callback<number>): Promise<number>;
    key(keyIndex: number, callback?: Callback<string | null>): Promise<string | null>;
    keys(callback?: Callback<string[]>): Promise<string[]>;
    iterate<T, U>(iteratee: DbIterator<T, U>, callback?: Callback<U | null | void>): Promise<U | null | void>;
}
export interface Methods extends MethodsCore {
    dropInstance(options?: Partial<InstanceOptions>, callback?: Callback<void>): Promise<void>;
}
export interface OptionalDropInstanceMethods extends MethodsCore {
    dropInstance?: (options?: Partial<InstanceOptions>, callback?: Callback<void>) => Promise<void>;
}
export interface DriverCreator {
    _driver: string;
    _initStorage(options: Options): Promise<void>;
    _support?: boolean | (() => Promise<boolean>);
}
export interface Driver extends DriverCreator, Methods {
}
export interface OptionalDropInstanceDriver extends DriverCreator, OptionalDropInstanceMethods {
}
export interface Forage<DbInfo extends Options = Options> {
    _defaultConfig: Options;
    _dbInfo: DbInfo;
    config(): DbInfo;
    config(option: string): unknown;
    config(option: Partial<Options>): boolean | Promise<void> | Error;
    ready(callback?: ResultCallback<void>): Promise<void>;
}
export interface ILocalForage extends Forage {
    defineDriver(driverObject: OptionalDropInstanceDriver, callback?: ResultCallback<void>, errorCallback?: ErrorCallback): Promise<void>;
    driver(): string | null;
    getDriver(driverName: string, callback?: ResultCallback<OptionalDropInstanceDriver>, errorCallback?: ErrorCallback): Promise<OptionalDropInstanceDriver>;
    getSerializer(callback?: ResultCallback<typeof serializer>): Promise<typeof serializer>;
    setDriver(drivers: string | string[], callback?: ResultCallback<void>, errorCallback?: ErrorCallback): Promise<void>;
    supports(driverName: string): boolean;
    createInstance(options?: Options): LocalForageComplete;
}
export interface DefaultDriversName {
    INDEXEDDB: string;
    WEBSQL: string;
    LOCALSTORAGE: string;
}
export interface LocalForageComplete extends ILocalForage, OptionalDropInstanceDriver, DefaultDriversName {
}
