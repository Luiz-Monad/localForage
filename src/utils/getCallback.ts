export default function getCallback<T, A extends (onError: any, onResult?: T) => void>(): A | undefined {
    if (
        arguments.length &&
        typeof arguments[arguments.length - 1] === 'function'
    ) {
        return arguments[arguments.length - 1];
    }
}
