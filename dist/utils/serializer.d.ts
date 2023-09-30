declare function stringToBuffer(serializedString: string): ArrayBuffer;
declare function bufferToString(buffer: ArrayBuffer): string;
declare function serialize<T>(value: ArrayBufferView | ArrayBuffer | Blob | T | null, callback: (onDone: string | Error | null, onError?: unknown) => void): void;
declare function deserialize<T>(value: string): ArrayBuffer | Blob | T;
declare const localforageSerializer: {
    serialize: typeof serialize;
    deserialize: typeof deserialize;
    stringToBuffer: typeof stringToBuffer;
    bufferToString: typeof bufferToString;
};
export default localforageSerializer;
