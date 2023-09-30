import { Database } from 'websql';

declare global {
    declare let indexedDB: IDBFactory | undefined;
    declare let webkitIndexedDB: IDBFactory | undefined;
    declare let mozIndexedDB: IDBFactory | undefined;
    declare let OIndexedDB: IDBFactory | undefined;
    declare let msIndexedDB: IDBFactory | undefined;

    declare let BlobBuilder: BlobBuilder | undefined;
    declare let MSBlobBuilder: BlobBuilder | undefined;
    declare let MozBlobBuilder: BlobBuilder | undefined;
    declare let WebKitBlobBuilder: BlobBuilder | undefined;

    type BlobBuilder = {
        new (): BlobBuilder;
        getBlob(type?: string): Blob;
        append(part: BlobPart): void;
    };

    interface Window {}

    declare const openDatabase: Database['openDatabase'];
    interface SQLError {
        //static class bug in the lib
        QUOTA_ERR: number;
        SYNTAX_ERR: number;
    }
}

export {};
