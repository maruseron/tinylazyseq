import { Utils } from "./dist/src/Utils.js";

function* range(start, endInclusive) {
    for (let i = start; i <= endInclusive; i++) {
        yield i;
    }
}

async function* promiseRange(start, endInclusive) {
    for (const i of range(start, endInclusive))
        yield Promise.resolve(i);
}

describe("Utils", () => {
    const array       = [1, 2, 3, 4, 5];
    const promiseList = [1, 2, 3, 4, 5].map(x => Promise.resolve(x));
    const set         = new Set(array);
    const map         = new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4], ["e", 5]]);
    const gen         = range(1, 5)
    const asyncGen    = promiseRange(1, 5);
    const iterator    = array[Symbol.iterator]();
    const iterable    = {
        [Symbol.iterator]() {
            const values = [1, 2, 3, 4, 5]; let index = 0;
            return { next() {
                    if (index >= values.length) { return { value: undefined, done: true }; }
                    return { value: values[index++], done: false };
                } } } }

    describe("isIterable", () => {
        it("should return true (and type guard) if the provided value implements the iterator symbol", () => {
            expect(Utils.isIterable(array)).toBe(true);
            expect(Utils.isIterable(promiseList)).toBe(true);
            expect(Utils.isIterable(set)).toBe(true);
            expect(Utils.isIterable(map)).toBe(true);
            expect(Utils.isIterable(gen)).toBe(true); // gen is an IterableIterator
            expect(Utils.isIterable(iterable)).toBe(true);
            expect(Utils.isIterable(iterator)).toBe(true); // array iterators are IterableIterators
        });

        it("should return false if the provied value does not implement the iterator symbol", () => {
            expect(Utils.isIterable(asyncGen)).toBe(false);
        });
    });

    describe("isAsyncIterable", () => {
        it("should return true (and type guard) if the provided value implements the asyncIterator symbol", () => {
            expect(Utils.isAsyncIterable(asyncGen)).toBe(true);
        });

        it("should return false if the provided value does not implement the asyncIterator symbol", () => {
            expect(Utils.isAsyncIterable(promiseList)).toBe(false);
            expect(Utils.isAsyncIterable(array)).toBe(false);
            expect(Utils.isAsyncIterable(set)).toBe(false);
            expect(Utils.isAsyncIterable(iterable)).toBe(false);
            expect(Utils.isAsyncIterable(gen)).toBe(false);
        })
    });

    describe("isIterator", () => {
        it("should return true (and type guard) if the provided value implements a next method", () => {
            expect(Utils.isIterator(gen)).toBe(true);
            expect(Utils.isIterator(asyncGen)).toBe(true);
            expect(Utils.isIterator(iterator)).toBe(true);
        });

        it("should return false if the provided value does not implement a next method", () => {
            expect(Utils.isIterator(array)).toBe(false);
            expect(Utils.isIterator(set)).toBe(false);
            expect(Utils.isIterator(map)).toBe(false);
            expect(Utils.isIterator(iterable)).toBe(false);
        });
    });

    describe("isLengthed", () => {
        it("should return true (and type intersect) if the provided value implements a numeric length property", () => {
            expect(Utils.isLenghted(array)).toBe(true);
            expect(Utils.isLenghted(promiseList)).toBe(true);
        });

        it("should return false if the provided value does not implement a numeric length property", () => {
            expect(Utils.isLenghted(set)).toBe(false);
            expect(Utils.isLenghted(map)).toBe(false);
            expect(Utils.isLenghted(gen)).toBe(false);
        });
    });

    describe("isSized", () => {
        it("should return true (and type intersect) if the provided value implements a numeric size property", () => {
            expect(Utils.isSized(set)).toBe(true);
            expect(Utils.isSized(map)).toBe(true);
        });

        it("should return false if the provided value does not implement a numeric size property", () => {
            expect(Utils.isSized(array)).toBe(false);
            expect(Utils.isSized(promiseList)).toBe(false);
            expect(Utils.isSized(gen)).toBe(false);
        });
    });

    describe("IllegalStateError", () => {
        it("should be an instance of Error", () => {
            expect(new Utils.IllegalStateError()).toBeInstanceOf(Error);
        });
    });
});