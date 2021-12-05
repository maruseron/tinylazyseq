export class Utils {
    public static isIterable<T>(value: any): value is Iterable<T> {
        return typeof value[Symbol.iterator] === "function";
    }

    public static isAsyncIterable<T>(value: any): value is AsyncIterable<T> {
        return typeof value[Symbol.asyncIterator] === "function";
    }

    public static isIterator<T>(value: any): value is Iterator<T> {
        return typeof value["next"] === "function";
    }

    public static isLenghted<T>(value: T): value is T & { length: number } {
        return typeof (value as any)["length"] === "number";
    }
    
    public static isSized<T>(value: T): value is T & { size: number } {
        return typeof (value as any)["size"] === "number";
    }

    public static readonly IllegalStateError = class IllegalStateError extends Error {
        constructor(message?: string) { super(message);
            Object.setPrototypeOf(this, new.target.prototype);
        }
    }
}