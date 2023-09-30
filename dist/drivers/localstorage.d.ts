import serializer from '../utils/serializer';
import { Driver, Forage, Options } from '../types';
export interface Module extends Driver, Forage<DbInfo> {
}
interface DbInfo extends Options {
    serializer: typeof serializer;
    keyPrefix: string;
}
declare var localStorageWrapper: Driver;
export default localStorageWrapper;
