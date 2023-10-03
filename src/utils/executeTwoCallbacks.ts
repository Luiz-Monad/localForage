import { ResultCallback, ErrorCallback } from '../types';

function executeTwoCallbacks<T>(
    promise: Promise<T>,
    callback?: ResultCallback<T>,
    errorCallback?: ErrorCallback
) {
    if (typeof callback === 'function') {
        promise.then(callback);
    }

    if (typeof errorCallback === 'function') {
        promise.catch(errorCallback);
    }
}

export default executeTwoCallbacks;
