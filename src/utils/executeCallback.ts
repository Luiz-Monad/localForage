function executeCallback<T>(promise: Promise<T>, callback?: Callback<T>) {
    if (callback) {
        promise.then(
            function (result) {
                callback(null, result);
            },
            function (error) {
                (callback as Function)(error);
            }
        );
    }
}

export default executeCallback;
