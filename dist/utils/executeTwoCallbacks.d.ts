import { ResultCallback, ErrorCallback } from '../types';
declare function executeTwoCallbacks<T>(promise: Promise<T>, callback?: ResultCallback<T>, errorCallback?: ErrorCallback): void;
export default executeTwoCallbacks;
