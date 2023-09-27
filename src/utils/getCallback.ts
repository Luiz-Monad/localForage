type Callback<T> = (onError: any, onResult?: T) => void;

export default function getCallback<T, A extends Callback<T>>(): A | undefined {
    if (arguments.length && typeof arguments[arguments.length - 1] === 'function') {
        return arguments[arguments.length - 1];
    }
}
