interface InstanceOptions {
    name: string;
    storeName: string;
}

interface Options extends InstanceOptions {
    driver?: string | string[] | null;
    size?: number;
    version?: number;
    description?: string;
}

type Callback<T> = (err: any, value: T) => void;
type DbIterator<T, U> = (
    result: T | undefined,
    value: string,
    iterationNumber: number
) => U | undefined;

interface MethodsCore {
    getItem<T>(key: string, callback?: Callback<T | undefined>): Promise<T | undefined>;
    setItem<T>(key: string, value: T | null, callback?: Callback<T | null>): Promise<T | null>;
    removeItem(key: string, callback?: Callback<void>): Promise<void>;
    clear(callback?: Callback<void>): Promise<void>;
    length(callback?: Callback<number>): Promise<number>;
    key(keyIndex: number, callback?: Callback<string | null>): Promise<string | null>;
    keys(callback?: Callback<string[]>): Promise<string[]>;
    iterate<T, U>(
        iteratee: DbIterator<T, U>,
        callback?: Callback<U | undefined | void>
    ): Promise<U | undefined | void>;
    dropInstance(options?: Partial<InstanceOptions>, callback?: Callback<void>): Promise<void>;
}

interface Driver extends MethodsCore {
    _driver: string;
    _initStorage(options: Options): Promise<void>;
    _support?: boolean | (() => Promise<boolean>);
}

interface OptionalDropInstanceDriver extends Driver {
    dropInstance?: (options?: Partial<InstanceOptions>, callback?: Callback<void>) => Promise<void>;
}

interface Forage<DbInfo extends Options> {
    _defaultConfig: Options;
    _dbInfo: DbInfo;
    config(): DbInfo;
    config(option: string): unknown;
    config(option: Partial<Options>): boolean | Promise<void> | Error;
    ready(callback?: () => void): Promise<void>;
}
