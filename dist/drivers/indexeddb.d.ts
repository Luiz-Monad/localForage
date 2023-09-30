import Promise from '../utils/promise';
import { Driver, Forage, Options } from '../types';
export interface Module extends Driver, Forage<DbInfo> {
    _initReady?: () => Promise<void>;
}
interface DbInfo extends Options {
    db: IDBDatabase | null;
    version: number;
}
declare var asyncStorage: Driver;
export default asyncStorage;
