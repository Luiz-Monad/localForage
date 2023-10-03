import { Callback, ResultCallback, ErrorCallback } from 'types';

export function promisify<Rest extends readonly unknown[], Result, Context>(
    func: (
        this: Context | undefined,
        ...args: [...rest: Rest, cb: Callback<Result>]
    ) => Promise<Result>,
    thisContext?: Context
): (...rest: Rest) => Promise<Result> {
    return (...rest: Rest) => {
        return new Promise<Result>((resolve, reject) => {
            try {
                const cb: Callback<Result> = (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                };
                func.apply(thisContext, [...rest, cb]);
            } catch (err: any) {
                reject(err);
            }
        });
    };
}

export function promisifyOne<Rest extends readonly unknown[], Result, Context>(
    func: (
        this: Context | undefined,
        ...args: [...rest: Rest, cb: ResultCallback<Result>]
    ) => Promise<Result>,
    thisContext?: Context
): (...rest: Rest) => Promise<Result> {
    return (...rest: Rest) => {
        return new Promise<Result>((resolve, reject) => {
            try {
                const cb: ResultCallback<Result> = (result) => {
                    resolve(result);
                };
                func.apply(thisContext, [...rest, cb]);
            } catch (err: any) {
                reject(err);
            }
        });
    };
}

export function promisifyTwo<Rest extends readonly unknown[], Result, Context>(
    func: (
        this: Context | undefined,
        ...args: [...rest: Rest, result: ResultCallback<Result>, err: ErrorCallback]
    ) => Promise<Result>,
    thisContext?: Context
): (...rest: Rest) => Promise<Result> {
    return (...rest: Rest) => {
        return new Promise<Result>((resolve, reject) => {
            try {
                const success: ResultCallback<Result> = (result) => {
                    resolve(result);
                };
                const fail: ErrorCallback = (err) => {
                    reject(err);
                };
                func.apply(thisContext, [...rest, success, fail]);
            } catch (err: any) {
                reject(err);
            }
        });
    };
}
