import { Callback } from '../types';
declare function executeTwoCallbacks<T>(promise: Promise<T>, callback?: Callback<T>, errorCallback?: Callback<void>): void;
export default executeTwoCallbacks;
