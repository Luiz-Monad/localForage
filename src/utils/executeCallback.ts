function executeCallback<T>(promise: Promise<T>, callback?: (onError: any, onResult?: T) => void) {
    if (callback) {
        promise.then(
            function (result) {
                callback(null, result);
            },
            function (error) {
                callback(error);
            }
        );
    }
}

export default executeCallback;
