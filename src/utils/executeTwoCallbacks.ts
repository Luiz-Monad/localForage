function executeTwoCallbacks<T>(promise: Promise<T>, callback?: Parameters<typeof promise.then>[0], errorCallback?: Parameters<typeof promise.catch>[0] ) {
    if (typeof callback === 'function') {
        promise.then(callback);
    }

    if (typeof errorCallback === 'function') {
        promise.catch(errorCallback);
    }
}

export default executeTwoCallbacks;
