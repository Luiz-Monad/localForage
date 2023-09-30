// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./node_modules/@types/websql/index.d.ts" />

declare module 'websql' {
    export type Database = WindowDatabase;
}
