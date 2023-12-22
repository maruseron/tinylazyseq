import { Sequence } from "./dist/src/Sequence.js";
import { Utils } from "./dist/src/Utils.js";
import { jest } from '@jest/globals';

describe("Sequence", () => {
    describe("of", () => {
        it("should return a sequence containing the arguments", () => {
            const seq = Sequence.of(1, 2, 3, 4, 5);
            expect(seq.first()).toBe(1);
            expect(seq.last()).toBe(5);
        });
    
        it("should return a sized sequence", () => {
            const seq = Sequence.of(1, 2, 3);
            expect(seq.size()).toBe(3);
        });
    });
    
    describe("from", () => {
        const array = [1, 2, 3, 4, 5, 6, 7];
        const set = new Set([1, 1, 2, 3, 4, 5, 6, 7]);
        // some unsized iterable
        const iter = {
            [Symbol.iterator]() {
                const values = [1, 2, 3, 4, 5, 6, 7]; let index = 0;
                return {
                    next() {
                        if (index >= values.length) { return { value: undefined, done: true }; }
                        return { value: values[index++], done: false };
                    }
                };
            }
        };
        it("should return a sequence containing the iterable's elements", () => {
            const arrayseq = Sequence.from(array);
            const setseq   = Sequence.from(set);
            const iterseq  = Sequence.from(iter);
            expect(arrayseq.first()).toBe(1);
            expect(arrayseq.last() ).toBe(7);
            expect(setseq.first()  ).toBe(1);
            expect(setseq.last()   ).toBe(7);
            expect(iterseq.first()  ).toBe(1);
            expect(iterseq.last()   ).toBe(7);
        });

        it("should return a ConstrainedSequence for iterators", () => {
            expect(Sequence.from(array[Symbol.iterator]()).iterated).not.toBeUndefined();
        });
    
        it("should return a sized sequence if the iterable is sized", () => {
            const arrayseq = Sequence.from(array);
            const setseq   = Sequence.from(set);
            const iterseq  = Sequence.from(iter);
            expect(arrayseq.size()).toBe(7);
            expect(setseq.size()).toBe(7);
            expect(iterseq.size()).toBeLessThan(0);
        });
    });
    
    describe("empty", () => {
        it("should return a sequence with no elements", () => {
            const seq = Sequence.empty();
            expect(seq.size()).toBe(0);
            expect(seq.toArray()).toHaveLength(0);
        });
    
        it("should not return the same element with every invocation", () => {
            expect(Sequence.empty()).not.toBe(Sequence.empty());
        });
    
        it("should return a sized sequence", () => {
            const seq = Sequence.empty();
            expect(seq.size()).toBe(0);
        });
    });
    
    describe("generate", () => {
        it("should return a sequence providing elements until the next function returns null", () => {
            const seq = Sequence.generate(0, (current) => current >= 10 ? null : current + 1);
            expect(seq.first()).toBe(0);
            expect(seq.last()).toBe(10);
        });
    
        it("should return an unsized sequence", () => {
            const seq = Sequence.generate(0, current => current + 1);
            expect(seq.size()).toBeLessThan(0);
        });
    });
    
    describe("concat", () => {
        it("should return a sequence containing the elements of this and the other sequence", () => {
            const seq   = Sequence.of(1, 2, 3);
            const other = Sequence.of(4, 5, 6);

            const concatted = seq.concat(other);

            expect(concatted.first()).toBe(1);
            expect(concatted.last()).toBe(6);
        });

        it("should retain size information", () => {
            const seq   = Sequence.of(1, 2, 3);
            const other = Sequence.of(4, 5, 6);

            expect(seq.concat(other).size()).toBe(6);

            const generator = Sequence.generate(4, x => x);

            expect(seq.concat(generator).size()).toBeLessThan(0);
        })
    });

    describe("contains", () => {
        const a = { name: "peter", lastname: "parker" };
        const b = { name: "bruce", lastname: "wayne"  };
        const c = { name: "clark", lastname: "kent"   };
        it("should return true if the value passed is identical to some value in the sequence", () => {
            const seq = Sequence.of(a, b, c);
            expect(seq.contains(b)).toBe(true);
        });

        it("should return false if the value passed is not identical to any in the sequence", () => {
            const seq = Sequence.of(a, b, c);
            const d = { name: "tony", lastname: "stark" };
            expect(seq.contains(d)).toBe(false);
        });
    });

    describe("containsAll", () => {
        const a = { name: "peter", lastname: "parker" };
        const b = { name: "bruce", lastname: "wayne"  };
        const c = { name: "clark", lastname: "kent"   };
        const d = { name: "tony" , lastname: "stark"   };
        const haystack    = Sequence.of(a, b, c, d);
        const trueNeedle  = [b, c];
        const falseNeedle = [d, { name: "natasha", lastname: "romanov" } ];

        it("should return true if all values provided are contained in the sequence", () => {
            expect(haystack.containsAll(trueNeedle)) .toBe(true);
            expect(haystack.containsAll(falseNeedle)).toBe(false);
        })
    });

    describe("constrainOnce", () => {
        it("should throw an illegalstateerror upon multiple iteration", () => {
            const seq = Sequence.of(1, 2, 3, 4, 5).constrainOnce();
            expect(seq.fold(0, (acc, curr) => acc + curr)).toBe(15);
            expect(() => seq.forEach(jest.fn())).toThrow(Utils.IllegalStateError);
        });
    });

    describe("count", () => {
        const seq = Sequence.of(1, 2, 3, 4, 5);
        it("should return the amount of elements fulfilling a predicate if given", () => {
            expect(seq.count(num => num < 3)).toBe(2);
        });

        it("should return the amount of elements in the sequence if no predicate is provided", () => {
            expect(seq.count()).toBe(5);
        });
    });

    describe("drop", () => {
        const seq = Sequence.of(1, 2, 3, 4, 5);
        it("should drop n amounts of elements from a sequence", () => {
            expect(seq.drop(2).first()).toBe(3);
        });

        it("should retain size information", () => {
            expect(seq.drop(2).size()).toBe(3);
            expect(seq.drop(7).size()).toBe(0);
            expect(Sequence.generate(0, x => x).drop(100).size()).toBeLessThan(0);
        });
    });

    describe("dropWhile", () => {
        it("should drop elements until predicate returns false", () => {
            const books = Sequence.of({ name: "book1",  price: 10 },
                                      { name: "book2",  price: 10 },
                                      { name: "book3",  price: 20 },
                                      { name: "book4",  price: 20 },
                                      { name: "book5",  price: 30 },
                                      { name: "book6",  price: 30 },
                                      { name: "book7",  price: 40 },
                                      { name: "book8",  price: 40 },
                                      { name: "book9",  price: 50 },
                                      { name: "book10", price: 50 });
            expect(books.dropWhile(book => book.price < 30).first().name).toBe("book5");
        });
    });

    describe("elementAt", () => {
        const seq = Sequence.of("foo", "bar", "baz");
        it("should return the element at said index or undefined", () => {
            expect(seq.elementAt(1)).toBe("bar");
            expect(seq.elementAt(5)).toBeUndefined();
        });

        it("should return undefined for indexes under zero", () => {
            expect(seq.elementAt(-1)).toBeUndefined();
        });
    });

    describe("every", () => {
        const seq = Sequence.of(5, 7, 9, 11);
        it("should return true if all elements fulfill the predicate", () => {
            expect(seq.every(num => num % 2 !== 0)).toBe(true);
        });

        it("should return false if not all elements fulfill the predicate", () => {
            expect(seq.every(num => num % 2 !== 0 && num < 10)).toBe(false);
        });
    });

    describe("filter", () => {
        it("should keep the elements that fulfill the predicate", () => {
            const shuffledBooks = Sequence.of({ name: "book1",  price: 10 },
                                              { name: "book2",  price: 20 },
                                              { name: "book3",  price: 30 },
                                              { name: "book4",  price: 20 },
                                              { name: "book5",  price: 30 },
                                              { name: "book6",  price: 20 },
                                              { name: "book7",  price: 40 },
                                              { name: "book8",  price: 30 },
                                              { name: "book9",  price: 50 },
                                              { name: "book10", price: 20 });
            expect(shuffledBooks.filter(book => book.price === 30).count()).toBe(3);
        });
    });

    describe("find", () => {
        it("should return the first item fulfilling a predicate or undefined", () => {
            const haystack = Sequence.of({ name: "john"  , id: 0 },
                                         { name: "maria" , id: 1 },
                                         { name: "needle", id: 2 },
                                         { name: "albert", id: 3 },
                                         { name: "needle", id: 4 });
            expect(haystack.find(item => item.name === "needle").id).toBe(2);
            expect(haystack.find(item => item.name === "some impossible value")).toBeUndefined();
        });
    });

    describe("findIndex", () => {
        const items = Sequence.of({ value:  32 },
                                  { value:  64 },
                                  { value: 128 },
                                  { value:  64 },
                                  { value:  32 });
        it("should return the index of the first element fulfilling a predicate", () => {
            expect(items.findIndex(item => item.value === 64)).toBe(1);
        });

        it("should return -1 if no element in the sequence fulfills a predicate", () => {
            expect(items.findIndex(item => item.value === 256)).toBeLessThan(0);
        });
    });

    describe("findLast", () => {
        it("should return the last item fulfilling a predicate or undefined", () => {
            const haystack = Sequence.of({ name: "john"  , id: 0 },
                                         { name: "maria" , id: 1 },
                                         { name: "needle", id: 2 },
                                         { name: "albert", id: 3 },
                                         { name: "needle", id: 4 });
            expect(haystack.findLast(item => item.name === "needle").id).toBe(4);
            expect(haystack.findLast(item => item.name === "your waifu is trash")).toBeUndefined();
        });
    });

    describe("findLastIndex", () => {
        const items = Sequence.of({ value:  32 },
                                  { value:  64 },
                                  { value: 128 },
                                  { value:  64 },
                                  { value:  32 });
        it("should return the index of the first element fulfilling a predicate", () => {
            expect(items.findLastIndex(item => item.value === 64)).toBe(3);
        });

        it("should return -1 if no element in the sequence fulfills a predicate", () => {
            expect(items.findLastIndex(item => item.value === 256)).toBeLessThan(0);
        });
    });

    describe("first", () => {
        it("should return the first item or undefined", () => {
            expect(Sequence.of("foo", "bar", "baz").first()).toBe("foo");
            expect(Sequence.empty().first()).toBeUndefined();
        });
    });

    describe("flatten", () => {
        it("should flatten by one level", () => {
            const nested = Sequence.of(Sequence.of(1, 2, 3), Sequence.of(4, 5, 6));
            expect(nested.flatten().count()).toBe(6);
        });
    });

    describe("flatMap", () => {
        it("should transform and flatten by one level", () => {
            const seq = Sequence.of("foo", "bar", "baz");
            expect(seq.flatMap(item => Sequence.from(item)).count()).toBe(9);
        });
    });

    describe("fold", () => {
        it("should reduce with an initial value", () => {
            const seq = Sequence.of(1, 2, 3, 4, 5);
            expect(seq.fold(5, (acc, item) => acc + item)).toBe(20);
        });

        it("should default to the initial value for empty sequences", () => {
            const seq = Sequence.empty();
            expect(seq.fold(5, (acc, item) => acc + item)).toBe(5);
        });
    });

    describe("forEach", () => {
        it("should perform an operation for every value in the sequence", () => {
            const fn = jest.fn();
            const seq = Sequence.of(1, 2, 3, 4, 5);
            expect(seq.forEach(fn)).toBeUndefined();
            expect(fn).toBeCalledTimes(5);
        });
    });

    describe("groupBy", () => {
        it("should group elements to a map by a selector function", () => {
            const seq = Sequence.of(
                { name: "María", grade: 5.0 }, 
                { name: "Juan" , grade: 6.5 }, 
                { name: "Pedro", grade: 3.7 },
                { name: "María", grade: 7.0 })
            const map = seq.groupBy(item => item.name);
            expect(map).toBeInstanceOf(Map);
            expect(map.get("María").length == 2);
        });
    });

    describe("indexOf", () => {
        it("should return the index of the value provided or -1", () => {
            const needle = { name: "bar" };
            const haystack = Sequence.of({ name: "foo" }, needle, { name: "baz" });
            expect(haystack.indexOf(needle)).toBe(1);
            expect(haystack.indexOf({ name: "boo" })).toBeLessThan(0);
        });
    });

    describe("isEmpty", () => {
        it("should return true for sequences with no elements", () => {
            expect(Sequence.empty().isEmpty()).toBe(true);
            expect(Sequence.of().isEmpty()).toBe(true);
            expect(Sequence.of(1, 2, 3).filter(item => typeof item === "string").isEmpty())
                .toBe(true);
        });

        it("should return false for sequences with elements", () => {
            expect(Sequence.of(1, 2, 3).isEmpty()).toBe(false);
        });
    });

    describe("join", () => {
        it("should return an empty string for empty sequences by default", () => {
            expect(Sequence.empty().join()).toBe("");
        });

        it("should use toString if no transform is specified", () => {
            expect(Sequence.of(1, 2, 3).join()).toBe("1, 2, 3");
        });

        it("should use transform if provided", () => {
            expect(Sequence.of(1, 2, 3).join({ transform: num => "Number " + num }))
                .toBe("Number 1, Number 2, Number 3");
        });

        it("should use prefix and postfixes if provided", () => {
            expect(Sequence.of(1, 2, 3).join({ prefix: "List [", postfix: "]" }))
                .toBe("List [1, 2, 3]");
        });

        it("should limit the amount of elements taken and use truncated when limit is specified", () => {
            expect(Sequence.generate(0, num => num + 1).take(20).join({ limit: 10 }))
                .toBe("0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...");
        });
    });

    describe("last", () => {
        it("should return the last element of a non-empty sequence", () => {
            const seq = Sequence.of(1, 2, 3, 4, 5);
            expect(seq.last()).toBe(5);
        });

        it("should return undefined for an empty-sequence", () => {
            const seq = Sequence.empty();
            expect(seq.last()).toBeUndefined();
        });
    });

    describe("lastIndexOf", () => {
        it("should return the last index of the value provided or -1", () => {
            const needle = { name: "bar" };
            const haystack = Sequence.of({ name: "foo" }, needle, { name: "baz" }, needle);
            expect(haystack.lastIndexOf(needle)).toBe(3);
            expect(haystack.lastIndexOf({ name: "boo" })).toBeLessThan(0);
        });
    });

    describe("map", () => {
        it("should transform each value with the provided transformator", () => {
            const seq = Sequence.of(1, 2, 3, 4, 5);
            expect(seq.map(item => item + 4).join()).toBe("5, 6, 7, 8, 9");
        });
    });

    describe("reduce", () => {
        it("should reduce without an initial value", () => {
            const seq = Sequence.of(1, 2, 3, 4, 5);
            expect(seq.reduce((acc, item) => acc + item)).toBe(15);
        });

        it("should default to null for empty sequences", () => {
            const seq = Sequence.empty();
            expect(seq.reduce((acc, item) => acc + item)).toBeNull();
        });
    });

    describe("size", () => {
        it("should return the size for known-size sequences", () => {
            const fn = jest.fn();
            expect(Sequence.empty().size()).toBe(0);
            expect(Sequence.of(1, 2).size()).toBe(2);
            expect(Sequence.from([1, 2, 3, 4]).size()).toBe(4);
            expect(Sequence.from(new Set([1, 2, 3, 4, 5, 6])).size()).toBe(6);
            expect(Sequence.from(new Map([["a", 1], ["b", 2]])).size()).toBe(2);
            expect(Sequence.of(1, 2, 3).map(fn).size()).toBe(3);
            expect(Sequence.of(1, 2, 3, 4, 5).take(2).size()).toBe(2);
            expect(Sequence.of(1, 2, 3, 4, 5).drop(2).size()).toBe(3);
        });

        it("should return less than 0 for unknown-size sequences", () => {
            const fn = jest.fn();
            const iter = { 
                [Symbol.iterator]() { 
                    const values = [1, 2, 3, 4, 5, 6, 7]; let index = 0;
                    return { next() { 
                        if (index >= values.length) { return { value: undefined, done: true }; } 
                        return { value: values[index++], done: false }; } 
                    }; 
                } 
            };
            expect(Sequence.of(1, 2, 3, 4, 5).filter(fn).size()).toBeLessThan(0);
            expect(Sequence.generate(0, x => x).take(2).size()).toBeLessThan(0);
            expect(Sequence.generate(0, x => x).drop(2).size()).toBeLessThan(0);
            expect(Sequence.from(iter).size()).toBeLessThan(0);
            expect(Sequence.from([1, 2, 3, 4, 5][Symbol.iterator]()).size()).toBeLessThan(0);
        });
    });

    describe("some", () => {
        it("should return true if there is at least one value if no predicate is given", () => {
            expect(Sequence.of(1).some()).toBe(true);
        });

        it("should return true if at least one element fulfills the provided predicate", () => {
            expect(Sequence.of("a", 1, true, {}).some(item => typeof item === "number"))
                .toBe(true);
        });

        it("should return false if the sequence is empty when no predicate is provided", () => {
            expect(Sequence.empty().some()).toBe(false);
        });

        it("should return false if no element fulfills the provided predicate", () => {
            expect(Sequence.of("a", 1, true, {}).some(item => item instanceof Date))
                .toBe(false);
        });
    });

    describe("take", () => {
        it("should remove all elements after the first n", () => {
            expect(Sequence.of(1, 2, 3, 4, 5).take(2).join()).toBe("1, 2");
            expect(Sequence.empty().take(2).join()).toBe("");
            expect(Sequence.generate(0, x => x + 1).take(5).join()).toBe("0, 1, 2, 3, 4");
        });

        it("should retain size information", () => {
            expect(Sequence.of(1, 2, 3, 4, 5).take(2).size()).toBe(2);
            expect(Sequence.empty().take(2).size()).toBe(0);
            expect(Sequence.generate(0, x => x + 1).take(5).size()).toBeLessThan(0);
        });
    });

    describe("takeWhile", () => {
        it("should drop elements until predicate returns false", () => {
            const books = Sequence.of({ name: "book1",  price: 10 },
                                      { name: "book2",  price: 10 },
                                      { name: "book3",  price: 20 },
                                      { name: "book4",  price: 20 },
                                      { name: "book5",  price: 30 },
                                      { name: "book6",  price: 30 },
                                      { name: "book7",  price: 40 },
                                      { name: "book8",  price: 40 },
                                      { name: "book9",  price: 50 },
                                      { name: "book10", price: 50 });
            expect(books.takeWhile(book => book.price < 30).last().name).toBe("book4");
        });
    });

    describe("toArray", () => {
        it("should collect all items into an array", () => {
            expect(Sequence.of("foo", "bar", "baz").toArray())
                .toEqual(expect.arrayContaining(["foo", "bar", "baz"]));
        });
    });

    describe("toString", () => {
        it("should return a specific string for empty sequences", () => {
            expect(Sequence.empty().toString()).toBe("Sequence (empty)");
        });

        it("should specify the size for sized sequences", () => {
            expect(Sequence.of(1, 2, 3).toString()).toBe("Sequence (3)");
        });

        it("should note the size is unknown for unsized sequences", () => {
            expect(Sequence.generate(0, x => x + 1).toString()).toBe("Sequence (unknown)");
        });
    });

    describe("toStringTag", () => {
        it("should return \"Sequence\"", () => {
            expect(Sequence.empty()[Symbol.toStringTag]()).toBe("Sequence");
        });
    });
});