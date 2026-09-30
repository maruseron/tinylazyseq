import { AsyncSequence } from "./dist/src/AsyncSequence.js";
import { Utils } from "./dist/src/Utils.js";
import { jest } from "@jest/globals";

const promised = (...values) => values.map(value => Promise.resolve(value));

describe("AsyncSequence", () => {
    describe("of", () => {
        it("should return a sequence containing the arguments", async () => {
            const seq = AsyncSequence.of(...promised(1, 2, 3, 4, 5));
            await expect(seq.first()).resolves.toBe(1);
            await expect(seq.last()).resolves.toBe(5);
        });

        it("should return a sized sequence", () => {
            expect(AsyncSequence.of(...promised(1, 2, 3)).size()).toBe(3);
        });
    });

    describe("from", () => {
        it("should return a sequence containing an iterable's resolved elements", async () => {
            const array = AsyncSequence.from(promised(1, 2, 3, 4, 5, 6, 7));
            const set = AsyncSequence.from(new Set(promised(1, 2, 3, 4, 5, 6, 7)));
            async function* values() {
                for (const value of promised(1, 2, 3, 4, 5, 6, 7)) yield value;
            }
            const asyncIterable = AsyncSequence.from({
                [Symbol.asyncIterator]() { return values(); }
            });

            await expect(array.first()).resolves.toBe(1);
            await expect(array.last()).resolves.toBe(7);
            await expect(set.first()).resolves.toBe(1);
            await expect(set.last()).resolves.toBe(7);
            await expect(asyncIterable.first()).resolves.toBe(1);
            await expect(asyncIterable.last()).resolves.toBe(7);
        });

        it("should make iterator-backed sequences single-use", async () => {
            const seq = AsyncSequence.from(promised(1, 2, 3)[Symbol.iterator]());
            await expect(seq.toArray()).resolves.toEqual([1, 2, 3]);
            await expect(seq.toArray()).rejects.toBeInstanceOf(Utils.IllegalStateError);
        });

        it("should return a sized sequence when the iterable is sized", () => {
            expect(AsyncSequence.from(promised(1, 2, 3)).size()).toBe(3);
            expect(AsyncSequence.from(new Set(promised(1, 2, 3))).size()).toBe(3);
        });
    });

    describe("empty", () => {
        it("should return a sequence with no elements", async () => {
            const seq = AsyncSequence.empty();
            expect(seq.size()).toBe(0);
            await expect(seq.toArray()).resolves.toHaveLength(0);
        });

        it("should not return the same element with every invocation", () => {
            expect(AsyncSequence.empty()).not.toBe(AsyncSequence.empty());
        });
    });

    describe("generate", () => {
        it("should generate values until the next function returns null", async () => {
            const seq = AsyncSequence.generate(Promise.resolve(0), current =>
                current >= 10 ? null : Promise.resolve(current + 1));
            await expect(seq.first()).resolves.toBe(0);
            await expect(seq.last()).resolves.toBe(10);
        });

        it("should return an unsized sequence", () => {
            expect(AsyncSequence.generate(Promise.resolve(0), current => current + 1).size())
                .toBeLessThan(0);
        });
    });

    describe("concat", () => {
        it("should return the elements of both sequences in order", async () => {
            const seq = AsyncSequence.of(...promised(1, 2, 3));
            const other = AsyncSequence.of(...promised(4, 5, 6));
            await expect(seq.concat(other).toArray()).resolves.toEqual([1, 2, 3, 4, 5, 6]);
        });

        it("should retain size only when both sequences have a known size", () => {
            const seq = AsyncSequence.of(...promised(1, 2, 3));
            const other = AsyncSequence.of(...promised(4, 5, 6));
            expect(seq.concat(other).size()).toBe(6);
            expect(seq.concat(AsyncSequence.generate(Promise.resolve(0), value => value + 1))
                .size()).toBeLessThan(0);
        });
    });

    describe("contains", () => {
        it("should resolve true for an identical element", async () => {
            const item = { name: "peter" };
            await expect(AsyncSequence.of(...promised(item, { name: "bruce" })).contains(item))
                .resolves.toBe(true);
        });

        it("should resolve false for a value not in the sequence", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3)).contains(4)).resolves.toBe(false);
        });
    });

    describe("containsAll", () => {
        it("should resolve true when every requested value is present", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3)).containsAll([1, 3]))
                .resolves.toBe(true);
        });

        it("should resolve false when a requested value is missing", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3)).containsAll([2, 4]))
                .resolves.toBe(false);
        });
    });

    describe("count", () => {
        it("should count elements fulfilling an asynchronous predicate", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5))
                .count(async value => value < 3)).resolves.toBe(2);
        });

        it("should count all elements without a predicate", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5)).count()).resolves.toBe(5);
        });
    });

    describe("drop", () => {
        it("should skip the first n elements", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5)).drop(2).first())
                .resolves.toBe(3);
        });

        it("should retain size information", () => {
            const seq = AsyncSequence.of(...promised(1, 2, 3, 4, 5));
            expect(seq.drop(2).size()).toBe(3);
            expect(seq.drop(7).size()).toBe(0);
            expect(AsyncSequence.generate(Promise.resolve(0), value => value).drop(2).size())
                .toBeLessThan(0);
        });
    });

    describe("dropWhile", () => {
        it("should skip elements while an asynchronous predicate is true", async () => {
            const seq = AsyncSequence.of(...promised(1, 2, 3, 4, 5));
            await expect(seq.dropWhile(async value => value < 3).first()).resolves.toBe(3);
        });
    });

    describe("elementAt", () => {
        it("should resolve to the element at the requested index or undefined", async () => {
            const seq = AsyncSequence.of(...promised("foo", "bar", "baz"));
            await expect(seq.elementAt(1)).resolves.toBe("bar");
            await expect(seq.elementAt(5)).resolves.toBeUndefined();
            await expect(seq.elementAt(-1)).resolves.toBeUndefined();
        });
    });

    describe("every", () => {
        it("should resolve true when all elements fulfill the asynchronous predicate", async () => {
            await expect(AsyncSequence.of(...promised(5, 7, 9))
                .every(async value => value % 2 !== 0)).resolves.toBe(true);
        });

        it("should resolve false when an element fails the predicate", async () => {
            await expect(AsyncSequence.of(...promised(5, 7, 9, 11))
                .every(async value => value < 10)).resolves.toBe(false);
        });
    });

    describe("filter", () => {
        it("should keep elements that fulfill an asynchronous predicate", async () => {
            const seq = AsyncSequence.of(...promised(1, 2, 3, 4, 5));
            await expect(seq.filter(async value => value % 2 === 0).toArray()).resolves.toEqual([2, 4]);
        });
    });

    describe("find", () => {
        it("should resolve to the first matching item or undefined", async () => {
            const seq = AsyncSequence.of(...promised("foo", "needle", "bar", "needle"));
            await expect(seq.find(async value => value === "needle")).resolves.toBe("needle");
            await expect(seq.find(async value => value === "missing")).resolves.toBeUndefined();
        });
    });

    describe("findIndex", () => {
        it("should resolve to the first matching index or -1", async () => {
            const seq = AsyncSequence.of(...promised(32, 64, 128, 64, 32));
            await expect(seq.findIndex(async value => value === 64)).resolves.toBe(1);
            await expect(seq.findIndex(async value => value === 256)).resolves.toBe(-1);
        });
    });

    describe("findLast", () => {
        it("should resolve to the last matching item or undefined", async () => {
            const seq = AsyncSequence.of(...promised("foo", "needle", "bar", "needle"));
            await expect(seq.findLast(async value => value === "needle")).resolves.toBe("needle");
            await expect(seq.findLast(async value => value === "missing")).resolves.toBeUndefined();
        });
    });

    describe("findLastIndex", () => {
        it("should resolve to the last matching index or -1", async () => {
            const seq = AsyncSequence.of(...promised(32, 64, 128, 64, 32));
            await expect(seq.findLastIndex(async value => value === 64)).resolves.toBe(3);
            await expect(seq.findLastIndex(async value => value === 256)).resolves.toBe(-1);
        });
    });

    describe("first", () => {
        it("should resolve to the first item or undefined", async () => {
            await expect(AsyncSequence.of(...promised("foo", "bar")).first()).resolves.toBe("foo");
            await expect(AsyncSequence.empty().first()).resolves.toBeUndefined();
        });
    });

    describe("flatten", () => {
        it("should flatten nested sequences by one level", async () => {
            const nested = AsyncSequence.of(
                Promise.resolve(AsyncSequence.of(...promised(1, 2, 3))),
                Promise.resolve(AsyncSequence.of(...promised(4, 5, 6))));
            await expect(nested.flatten().toArray()).resolves.toEqual([1, 2, 3, 4, 5, 6]);
        });
    });

    describe("flatMap", () => {
        it("should transform and flatten by one level", async () => {
            const seq = AsyncSequence.of(...promised("foo", "bar"));
            await expect(seq.flatMap(async value => AsyncSequence.from(promised(...value)))
                .toArray()).resolves.toEqual(["f", "o", "o", "b", "a", "r"]);
        });
    });

    describe("fold", () => {
        it("should fold values using an asynchronous operation", async () => {
            const seq = AsyncSequence.of(...promised(1, 2, 3, 4, 5));
            await expect(seq.fold(5, async (total, value) => total + value)).resolves.toBe(20);
        });

        it("should return the initial value for an empty sequence", async () => {
            await expect(AsyncSequence.empty().fold(5, async (total, value) => total + value))
                .resolves.toBe(5);
        });
    });

    describe("forEach", () => {
        it("should perform an asynchronous action for every value", async () => {
            const action = jest.fn(async () => {});
            await expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5)).forEach(action))
                .resolves.toBeUndefined();
            expect(action).toHaveBeenCalledTimes(5);
        });
    });

    describe("groupBy", () => {
        it("should group elements into map buckets by the selected key", async () => {
            const seq = AsyncSequence.of(
                Promise.resolve({ name: "María", grade: 5.0 }),
                Promise.resolve({ name: "Juan", grade: 6.5 }),
                Promise.resolve({ name: "Pedro", grade: 3.7 }),
                Promise.resolve({ name: "María", grade: 7.0 }));
            const map = await seq.groupBy(item => item.name);
            expect(map).toBeInstanceOf(Map);
            expect(map.get("María")).toHaveLength(2);
            expect(map.get("Juan")).toHaveLength(1);
        });
    });

    describe("indexOf", () => {
        it("should resolve to the index of an identical value or -1", async () => {
            const needle = { name: "bar" };
            const seq = AsyncSequence.of(...promised({ name: "foo" }, needle, { name: "baz" }));
            await expect(seq.indexOf(needle)).resolves.toBe(1);
            await expect(seq.indexOf({ name: "boo" })).resolves.toBe(-1);
        });
    });

    describe("isEmpty", () => {
        it("should resolve true for empty sequences", async () => {
            await expect(AsyncSequence.empty().isEmpty()).resolves.toBe(true);
            await expect(AsyncSequence.of().isEmpty()).resolves.toBe(true);
            await expect(AsyncSequence.of(...promised(1, 2, 3))
                .filter(value => typeof value === "string").isEmpty()).resolves.toBe(true);
        });

        it("should resolve false for non-empty sequences", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3)).isEmpty()).resolves.toBe(false);
        });
    });

    describe("join", () => {
        it("should resolve to an empty string for empty sequences", async () => {
            await expect(AsyncSequence.empty().join()).resolves.toBe("");
        });

        it("should stringify values by default", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3)).join()).resolves.toBe("1, 2, 3");
        });

        it("should use an asynchronous transform when provided", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3)).join({
                transform: async value => `Number ${value}`
            })).resolves.toBe("Number 1, Number 2, Number 3");
        });

        it("should use a prefix, postfix, and truncation limit", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3)).join({ prefix: "List [", postfix: "]" }))
                .resolves.toBe("List [1, 2, 3]");
            await expect(AsyncSequence.generate(Promise.resolve(0), value => value + 1).take(20)
                .join({ limit: 10 })).resolves.toBe("0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...");
            await expect(AsyncSequence.of(...promised(1, 2, 3)).join({ separator: " | " }))
                .resolves.toBe("1 | 2 | 3");
            await expect(AsyncSequence.of(...promised(1, 2, 3)).join({ limit: 2, truncated: "(more)" }))
                .resolves.toBe("1, 2, (more)");
        });
    });

    describe("last", () => {
        it("should resolve to the last item or undefined", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5)).last()).resolves.toBe(5);
            await expect(AsyncSequence.empty().last()).resolves.toBeUndefined();
        });
    });

    describe("lastIndexOf", () => {
        it("should resolve to the last index of an identical value or -1", async () => {
            const needle = { name: "bar" };
            const seq = AsyncSequence.of(...promised({ name: "foo" }, needle, { name: "baz" }, needle));
            await expect(seq.lastIndexOf(needle)).resolves.toBe(3);
            await expect(seq.lastIndexOf({ name: "boo" })).resolves.toBe(-1);
        });
    });

    describe("map", () => {
        it("should transform values asynchronously and retain size", async () => {
            const seq = AsyncSequence.of(...promised(1, 2, 3, 4, 5));
            const mapped = seq.map(async value => value + 4);
            await expect(mapped.join()).resolves.toBe("5, 6, 7, 8, 9");
            expect(mapped.size()).toBe(5);
        });
    });

    describe("reduce", () => {
        it("should reduce values without an initial value", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5))
                .reduce(async (total, value) => total + value)).resolves.toBe(15);
        });

        it("should resolve to null for an empty sequence", async () => {
            await expect(AsyncSequence.empty().reduce((total, value) => total + value))
                .resolves.toBeNull();
        });
    });

    describe("reversed", () => {
        it("should reverse the elements and retain known size", async () => {
            const reversed = await AsyncSequence.of(...promised(1, 2, 3)).reversed();
            await expect(reversed.toArray()).resolves.toEqual([3, 2, 1]);
            expect(reversed.size()).toBe(3);
        });

        it("should retain unknown size", async () => {
            const sequence = AsyncSequence.generate(Promise.resolve(1), value =>
                value < 3 ? value + 1 : null);
            const reversed = await sequence.reversed();
            await expect(reversed.toArray()).resolves.toEqual([3, 2, 1]);
            expect(reversed.size()).toBeLessThan(0);
        });
    });

    describe("size", () => {
        it("should return the size for known-size sequences", () => {
            expect(AsyncSequence.empty().size()).toBe(0);
            expect(AsyncSequence.of(...promised(1, 2)).size()).toBe(2);
            expect(AsyncSequence.from(promised(1, 2, 3, 4)).size()).toBe(4);
            expect(AsyncSequence.from(new Set(promised(1, 2, 3))).size()).toBe(3);
            expect(AsyncSequence.of(...promised(1, 2, 3)).map(value => value).size()).toBe(3);
            expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5)).take(2).size()).toBe(2);
            expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5)).drop(2).size()).toBe(3);
        });

        it("should return a negative number for unknown-size sequences", () => {
            expect(AsyncSequence.of(...promised(1, 2, 3)).filter(() => true).size()).toBeLessThan(0);
            expect(AsyncSequence.generate(Promise.resolve(0), value => value + 1).take(2).size())
                .toBeLessThan(0);
            expect(AsyncSequence.generate(Promise.resolve(0), value => value + 1).drop(2).size())
                .toBeLessThan(0);
            async function* values() { yield 1; }
            expect(AsyncSequence.from(values()).size()).toBeLessThan(0);
        });
    });

    describe("some", () => {
        it("should resolve true when the sequence has an element", async () => {
            await expect(AsyncSequence.of(...promised(1)).some()).resolves.toBe(true);
        });

        it("should resolve true when an element fulfills the asynchronous predicate", async () => {
            await expect(AsyncSequence.of(...promised("a", 1, true, {}))
                .some(async value => typeof value === "number")).resolves.toBe(true);
        });

        it("should resolve false for an empty sequence or no match", async () => {
            await expect(AsyncSequence.empty().some()).resolves.toBe(false);
            await expect(AsyncSequence.of(...promised("a", 1, true, {}))
                .some(async value => value instanceof Date)).resolves.toBe(false);
        });
    });

    describe("sorted", () => {
        it("should sort by string representation when no comparator is provided", async () => {
            const sorted = await AsyncSequence.of(...promised(10, 2, 1)).sorted();
            await expect(sorted.toArray()).resolves.toEqual([1, 10, 2]);
        });

        it("should sort with a comparator and retain size information", async () => {
            const sorted = await AsyncSequence.of(...promised(10, 2, 1))
                .sorted((a, b) => a - b);
            await expect(sorted.toArray()).resolves.toEqual([1, 2, 10]);
            expect(sorted.size()).toBe(3);

            const unknownSize = AsyncSequence.generate(Promise.resolve(3), value =>
                value > 1 ? value - 1 : null);
            expect((await unknownSize.sorted((a, b) => a - b)).size()).toBeLessThan(0);
        });
    });

    describe("take", () => {
        it("should keep only the first n elements", async () => {
            await expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5)).take(2).toArray())
                .resolves.toEqual([1, 2]);
            await expect(AsyncSequence.empty().take(2).toArray()).resolves.toEqual([]);
            await expect(AsyncSequence.generate(Promise.resolve(0), value => value + 1)
                .take(5).toArray()).resolves.toEqual([0, 1, 2, 3, 4]);
        });

        it("should retain size information when known", () => {
            expect(AsyncSequence.of(...promised(1, 2, 3, 4, 5)).take(2).size()).toBe(2);
            expect(AsyncSequence.empty().take(2).size()).toBe(0);
            expect(AsyncSequence.generate(Promise.resolve(0), value => value + 1).take(5).size())
                .toBeLessThan(0);
        });
    });

    describe("takeWhile", () => {
        it("should keep elements until an asynchronous predicate returns false", async () => {
            const seq = AsyncSequence.of(...promised(1, 2, 3, 4, 5));
            await expect(seq.takeWhile(async value => value < 4).toArray()).resolves.toEqual([1, 2, 3]);
        });
    });

    describe("toArray", () => {
        it("should collect all resolved items into an array", async () => {
            await expect(AsyncSequence.of(...promised("foo", "bar", "baz")).toArray())
                .resolves.toEqual(["foo", "bar", "baz"]);
        });
    });

    describe("toString", () => {
        it("should describe empty, sized, and unknown-size sequences", () => {
            expect(AsyncSequence.empty().toString()).toBe("AsyncSequence (empty)");
            expect(AsyncSequence.of(...promised(1, 2, 3)).toString()).toBe("AsyncSequence (3)");
            expect(AsyncSequence.generate(Promise.resolve(0), value => value + 1).toString())
                .toBe("AsyncSequence (unknown)");
        });
    });

    describe("toStringTag", () => {
        it("should return AsyncSequence", () => {
            expect(AsyncSequence.empty()[Symbol.toStringTag]()).toBe("AsyncSequence");
        });
    });
});