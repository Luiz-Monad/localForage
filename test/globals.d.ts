/* eslint-disable @typescript-eslint/ban-types */
import { LocalForageComplete } from 'types';

declare global {
    type LocalForageDriver = LocalForageComplete;
    declare const localforage: LocalForageComplete;

    declare const Modernizr: any;
    declare const requirejs: any;

    interface Window {
        localforage: LocalForageDriver;

        mochaResults: any;
        requireTest: boolean | undefined;
        callWhenReadyTest: boolean | undefined;
    }

    interface Console {
        infoLogs: { args: any[] }[];
    }
}

// polyfill types
declare global {
    // eslint-disable-next-line no-var
    declare var require: Function | undefined; //must be var because of scope exporting.
    declare const importScripts: Function;

    interface Window {
        indexedDB: IDBFactory | undefined;
        webkitIndexedDB: IDBFactory | undefined;
        mozIndexedDB: IDBFactory | undefined;
        OIndexedDB: IDBFactory | undefined;
        msIndexedDB: IDBFactory | undefined;

        oninstall: typeof onmessage;
        attachEvent: Function;
    }

    interface MessageEvent {
        waitUntil(promise: Promise);
    }

    namespace Chai {
        interface Assertion {
            (type: any, message?: string): Assertion;
        }
    }

    namespace Mocha {
        interface HookFunction {
            skip: PendingTestFunction;
        }
    }
}

// copy from src/globals.d.ts
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

    declare const openDatabase: WindowDatabase['openDatabase'];
    interface SQLError {
        //static class bug in the lib
        QUOTA_ERR: number;
        SYNTAX_ERR: number;
    }
}

export {};
