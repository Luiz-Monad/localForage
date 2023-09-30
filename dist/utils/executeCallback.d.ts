import { Callback } from '../types';
declare function executeCallback<T>(promise: Promise<T>, callback?: Callback<T>): void;
export default executeCallback;
