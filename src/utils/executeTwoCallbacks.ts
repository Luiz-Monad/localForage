function executeTwoCallbacks<T>(
    promise: Promise<T>,
    callback?: Callback<T | void>,
    errorCallback?: Callback<void>
) {
    if (typeof callback === 'function') {
        promise.then(callback);
    }

    if (typeof errorCallback === 'function') {
        promise.catch(errorCallback);
    }
}

export default executeTwoCallbacks;
