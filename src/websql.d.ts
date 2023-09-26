/// <reference path="./node_modules/@types/websql/index.d.ts" />

declare module 'websql' {
    export type Database = WindowDatabase;
}
