import { Callback } from '../types';

function executeTwoCallbacks<T>(
    promise: Promise<T>,
    callback?: Callback<T>,
    errorCallback?: Callback<void>
) {
    if (typeof callback === 'function') {
        promise.then(callback as any);
    }

    if (typeof errorCallback === 'function') {
        promise.catch(errorCallback);
    }
}

export default executeTwoCallbacks;
