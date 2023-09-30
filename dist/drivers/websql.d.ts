/// <reference types="websql" />
import serializer from '../utils/serializer';
import { Driver, Forage, Options } from '../types';
export interface Module extends Driver, Forage<DbInfo> {
}
interface DbInfo extends Options {
    db: Database | null;
    version: number;
    description: string;
    size: number;
    serializer: typeof serializer;
}
declare const webSQLStorage: Driver;
export default webSQLStorage;
