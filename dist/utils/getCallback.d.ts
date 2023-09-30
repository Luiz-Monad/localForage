type Callback<T> = (onError: any, onResult?: T) => void;
export default function getCallback<T, A extends Callback<T>>(): A | undefined;
export {};
