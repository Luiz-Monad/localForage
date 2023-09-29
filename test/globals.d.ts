import { LocalForageComplete } from '../src/types';

declare global {
    declare var Modernizr: any;
    declare var attachEvent: any;

    declare var define: Function & { amd?: any };
    declare var importScripts: Function;

    type LocalForageDriver = LocalForageComplete;
    declare var localforage: LocalForageComplete;

    interface Window {
        localforage: LocalForageDriver;

        indexedDB: IDBFactory | undefined;
        webkitIndexedDB: IDBFactory | undefined;
        mozIndexedDB: IDBFactory | undefined;
        OIndexedDB: IDBFactory | undefined;
        msIndexedDB: IDBFactory | undefined;

        mochaResults: any;
        oninstall: typeof onmessage;

        requiretest: boolean | undefined;
    }

    interface MessageEvent {
        waitUntil(promise: Promise);
    }

    interface Console {
        infoLogs: { args: any[] }[];
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

export {};
