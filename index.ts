/**
 * Describes a lazily computed sequence of elements that can be iterated over, allowing for 
 * composition of intermediate operations in an efficient, on-demand execution order.
 * @typeParam T The type of the values contained by this sequence.
 */
export class Sequence<T> implements Iterable<T> {
    /**
     * The underlying Iterable contained by this sequence. The values are dispatched
     * through its iterator, so any type implementing the iterator symbol is fine.
     */
    private readonly _values: Iterable<T>;
    /**
     * A cached size for sequences with available size information (eg. sequences made from an 
     * iterable, or sequences mapped from an already sized sequence). Less than 0 for 
     * non-deterministically sized sequences, like FilterSequences.
     */
    private readonly _size: number;
    private constructor(iterable: Iterable<T>, size?: number) {
        this._values = iterable;
        if (size !== undefined) {
            this._size = size;
        } else {
            if (isLenghted(iterable)) {
                this._size = iterable.length;
            } else if (isSized(iterable)) {
                this._size = iterable.size;
            }
            else this._size = -1;
        }
    }

    /**
     * Creates a lazy sequence containing the provided arguments.\
     * The sequence created is sized (known).
     */
    public static of<T>(...args: T[]): Sequence<T> {
        return new Sequence(args, args.length);
    }

    /**
     * Creates a lazy sequence wrapping the provided iterable.
     * The sequence created is sized if the provided iterable has a `length` or `size` property.\
     * Otherwise, size is less than 0 (unknown).
     */
    public static from<T>(iterable: Iterable<T>): Sequence<T> {
        return new Sequence(iterable);
    }

    /**
     * Creates a lazy sequence containing no elements.\
     * The sequence created is sized (0).
     */
    public static empty<T>(): Sequence<T> {
        return new Sequence([], 0);
    }

    /**
     * Creates a lazy sequence whose elements are generated by the recursive application of
     * `nextValue` on `initial` until `nextValue` returns `null`.\
     * The sequence created is non-sized (unknown).
     */
    public static generate<T>(initial: T, nextValue: (current: T) => T | null): Sequence<T> {
        return new (class GeneratorSequence extends Sequence<T> {
            override *[Symbol.iterator]() {
                let current: T | null = initial;
                yield initial;
                while (current !== null) {
                    if ((current = nextValue(current)) != null) {
                        yield current;
                    }
                }
            }
        })([], -1);
    }

    /**
     * Returns a new {@link Sequence} containing the values of this sequence and the
     * one provided as an argument.This operation is intermediate and stateless.\
     * \
     * The created sequence will be sized if and only if both of the contatenated sequences are of
     * known size. Otherwise, size information is lost.
     */
    public concat(other: Sequence<T>): Sequence<T> {
        return new (class ConcatSequence extends Sequence<T> {
            constructor(iterable: Iterable<T>, size: number) {
                if (size < 0 || other._size < 0) { super(iterable, -1); } 
                else { super(iterable, size + other._size); }
            }
            override *[Symbol.iterator]() {
                for (const item of this._values) {
                    yield item;
                }
                for (const item of other._values) {
                    yield item;
                }
            }
        })(this, this._size);
    }

    /**
     * Returns true if `value` is identical to one contained by this sequence.
     * This is a short-circuiting terminal operation.
     */
    public contains(value: T): boolean {
        for (const item of this) {
            if (item === value) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns true if all the values in `values` are contained by this sequence.
     * This is a short-circuiting terminal operation.
     */
    public containsAll(values: Iterable<T>): boolean {
        for (const value of values) {
            if (!this.contains(value)) {
                return false;
            }
        }
        return true;
    }

    /**
     * If a predicate is provided, returns the amount of elements in this sequence that
     * fulfilled it. Otherwise, returns the amount of elements in this sequence.
     * This is a terminal operation.
     */
    public count(): number;
    public count(predicate: (item: T) => boolean): number;
    public count(predicate: (item: T, index?: number) => boolean): number;
    public count(predicate: (item: T, index: number) => boolean = _ => true): number {
        let index = 0;
        let count = 0;
        for (const item of this) {
            if (predicate(item, index++)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Returns a new {@link Sequence} skipping the first `n` elements.
     * This operation is intermediate and stateful.\
     * \
     * The sequence created retains size information.
     */
    public drop(n: number): Sequence<T> {
        return new (class DropSequence extends Sequence<T> {
            constructor(iterable: Iterable<T>, size: number) { 
                if (size < 0) {
                    super(iterable, -1);
                } else {
                    super(iterable, size - n < 0 ? 0 : size - n); 
                }
            }
            override *[Symbol.iterator]() {
                let dropped = 0;
                for (const item of this._values) {
                    if (dropped++ >= n) {
                        yield item;
                    }
                }
            }
        })(this, this._size);
    }

    /**
     * Returns a new {@link Sequence} skipping the first n elements that fulfill a given predicate.
     * This operation is intermediate and stateful.\
     * \
     * The sequence created is non-sized.
     */
    public dropWhile(predicate: (item: T) => boolean): Sequence<T>;
    public dropWhile(predicate: (item: T, index?: number) => boolean): Sequence<T>;
    public dropWhile(predicate: (item: T, index: number) => boolean): Sequence<T> {
        return new (class DropWhileSequence extends Sequence<T> {
            override *[Symbol.iterator]() {
                let yielding = false;
                let index = 0;
                for (const item of this._values) {
                    if (!predicate(item, index++)) yielding = true;
                    if (yielding) yield item;
                }
            }
        })(this, -1);
    }

    /**
     * Returns the element at `index`, or undefined if the index is out of bounds.
     * Since {@link Sequence}s are not a Random Access collection, this operation is O(n).
     * This is a short-circuiting terminal operation.
     */
    public elementAt(index: number): T | undefined {
        if (index < 0) return undefined;
        let count = 0;
        for (const item of this) {
            if (index === count++) return item;
        }
        return undefined;
    }

    /**
     * Returns true if all elements in this sequence fulfill the given predicate.
     * This is a short-circuiting terminal operation.
     */
    public every(predicate: (item: T) => boolean): boolean;
    public every(predicate: (item: T, index?: number) => boolean): boolean;
    public every(predicate: (item: T, index: number) => boolean): boolean {
        let index = 0;
        for (const item of this) {
            if (!predicate(item, index++)) return false;
        }
        return true;
    }

    /**
     * Returns a new {@link Sequence} keeping the elements in this sequence that fulfill the
     * given predicate.
     * This operation is intermediate and stateless.\
     * \
     * The sequence created is non-sized.
     */
    public filter(predicate: (item: T) => boolean): Sequence<T>;
    public filter(predicate: (item: T, index?: number) => boolean): Sequence<T>;
    public filter<S extends T>(predicate: (item: T) => boolean): Sequence<S>;
    public filter<S extends T>(predicate: (item: T, index?: number) => boolean): Sequence<S>;
    public filter<S extends T>(predicate: (item: T, index: number) => boolean): Sequence<T> | Sequence<S> {
        return new (class FilterSequence extends Sequence<T> {
            override *[Symbol.iterator]() {
                let index = 0;
                for (const value of this._values) {
                    if (predicate(value, index++)) yield value;
                }
            }
        })(this as any, -1);
    }

    /**
     * Returns the first item fulfilling a predicate, or undefined if none does.
     * This is a short-circuiting terminal operation.
     */
    public find(predicate: (item: T) => boolean): T | undefined;
    public find(predicate: (item: T, index?: number) => boolean): T | undefined;
    public find(predicate: (item: T, index: number) => boolean): T | undefined {
        let index = 0;
        for (const item of this) {
            if (predicate(item, index++)) return item;
        }
        return undefined;
    }

    /**
     * Returns the index of the first item fulfilling a predicate, or -1 if none does.
     * This is a short-circuiting terminal operation.
     */
    public findIndex(predicate: (item: T) => boolean): number {
        let index = 0;
        for (const item of this) {
            if (predicate(item)) return index;
            index++;
        }
        return -1;
    }
    
    /**
     * Returns the last item fulfilling a predicate, or undefined if none does.
     * This is a terminal operation.
     */
    public findLast(predicate: (item: T) => boolean): T | undefined;
    public findLast(predicate: (item: T, index?: number) => boolean): T | undefined;
    public findLast(predicate: (item: T, index: number) => boolean): T | undefined {
        let index = 0;
        let result: T | undefined;
        for (const item of this) {
            if (predicate(item, index++)) result = item;
        }
        return result;
    }

    /**
     * Returns the index of the last item fulfilling a predicate, or -1 if none does.
     * This is a terminal operation.
     */
    public findLastIndex(predicate: (item: T) => boolean): number {
        let result = -1;
        let current = 0;
        for (const item of this) {
            if (predicate(item)) result = current;
            current++;
        }
        return result;
    }

    /**
     * Returns the first element of this sequence, or undefined if it's empty. 
     * This is a short-circuiting terminal operation and it does not hang for infinite sequences.
     */
    public first(): T | undefined {
        for (const item of this) return item;
        return undefined;
    }
    
    /**
     * Returns a new {@link Sequence} flattening every inner sequence of this collection by one level.
     * This operation is intermediate and stateless.\
     * \
     * The sequence created is non-sized.
     */
    public flatten<T>(this: Sequence<Sequence<T>>): Sequence<T> {
        return new (class FlatteningSequence extends Sequence<T> {
            override *[Symbol.iterator]() {
                for (const value of this._values) {
                    yield *value as any;
                }
            }
        })(this as any);
    }

    /**
     * Returns a new {@link Sequence} flattening every sequence generated by the transformator function
     * by one level. This operation is intermediate and stateless.\
     * \
     * The sequence created is non-sized.
     */
    public flatMap<U>(transform: (item: T) => Sequence<U>): Sequence<U>;
    public flatMap<U>(transform: (item: T, index?: number) => Sequence<U>): Sequence<U>;
    public flatMap<U>(transform: (item: T, index: number) => Sequence<U>): Sequence<U> {
        return new (class FlatMapSequence extends Sequence<U> { 
            override *[Symbol.iterator]() {
                let index = 0;
                for (const value of this._values) {
                    yield *transform(value as any, index++);
                }
            }
        })(this as any);
    }

    /**
     * Returns a value resulting from recursively applying an operation on an initial value and
     * the current value for every item of this sequence. This is a terminal operation. 
     */
    public fold<R>(initial: R, operation: (accumulator: R, current: T) => R): R 
    public fold<R>(initial: R, operation: (accumulator: R, current: T, index?: number) => R): R 
    public fold<R>(initial: R, operation: (accumulator: R, current: T, index: number) => R): R {
        let index = 0;
        let result = initial;
        for (const item of this) {
            result = operation(result, item, index++);
        }
        return result;
    }

    /**
     * Performs an action on every item of this sequence. This is a terminal operation.
     */
    public forEach(action: (item: T) => void): void
    public forEach(action: (item: T, index?: number) => void): void
    public forEach(action: (item: T, index: number) => void): void {
        let index = 0;
        for (const item of this) {
            action(item, index++);
        }
    }

    /**
     * Returns the index of the first item of this sequence `value` is identical to.
     * If there is none, returns -1. This is a short-circuiting terminal operation.
     */
    public indexOf(value: T): number {
        let index = 0;
        for (const item of this) {
            if (item === value) return index;
            index++;
        }
        return -1;
    }

    /**
     * Returns true if this collection contains no elements. This is a short-circuiting
     * terminal operation and it does not hang for infinite sequences.
     */
    public isEmpty(): boolean {
        for (const _ of this) return false;
        return true;
    }

    /**
     * Returns a string representation of this sequence. This is a terminal operation.
     */
    public join(): string
    public join(separator: string): string;
    public join(separator: string, prefix: string): string;
    public join(separator: string, prefix: string, postfix: string): string;
    public join(separator: string, prefix: string, postfix: string, limit: number): string;
    public join(separator: string, prefix: string, postfix: string, limit: number, truncated: string): string;
    public join(separator: string, prefix: string, postfix: string, limit: number, truncated: string, transform: (item: T) => string): string;
    public join(
        separator: string = ", ",
        prefix: string = "",
        postfix: string = "",
        limit: number = -1,
        truncated: string = "...",
        transform: ((e: T) => string) | null = null
    ): string {
        let base: string = prefix;
        let count = 0;
        for (const item of this) {
            if (++count > 1) base += separator;
            if (limit < 0 || count <= limit) {
                if (transform) {
                    base += transform(item);
                } else {
                    base += (item as any).toString();
                }
            } else break;
        }
        if (limit >= 0 && count > limit) {
            base += truncated;
        }
        base += postfix;
        return base;
    }

    /**
     * Returns the last element contained by this sequence. This is a short-circuiting 
     * terminal operation and it does not hang for infinite sequences
     */
    public last(): T | undefined {
        let result: T | undefined;
        for (const item of this) {
            result = item;
        }
        return result;
    }

    /**
     * Returns the index of the last element of this sequence `value` is identical to, or -1 if none is.
     * This is a terminal operation.
     */
    public lastIndexOf(value: T): number {
        let result = -1;
        let index = 0;
        for (const item of this) {
            if (item === value) result = index;
            index++;
        }
        return result;
    }

    /**
     * Returns a new {@link Sequence} transforming each value of this sequence.
     * This operation is intermediate and stateless.\
     * \
     * The sequence created retains size information.
     */
    public map<U>(transform: (item: T) => U): Sequence<U>;
    public map<U>(transform: (item: T, index?: number) => U): Sequence<U>;
    public map<U>(transform: (item: T, index: number) => U): Sequence<U> {
        return new (class MapSequence extends Sequence<U> { 
            override *[Symbol.iterator]() {
                let index = 0;
                for (const value of this._values) {
                    yield transform(value as any, index++);
                }
            }
        })(this as any, this._size);
    }

    /**
     * Returns a value resulting from recursively applying an operation on the first element 
     * of this sequence and the current value for every item of this sequence after the first. 
     * This is a terminal operation. 
     */
    public reduce<R extends T>(operation: (accumulator: R, current: T) => R): R | null
    public reduce<R extends T>(operation: (accumulator: R, current: T, index?: number) => R): R | null 
    public reduce<R extends T>(operation: (accumulator: R, current: T, index: number) => R): R | null {
        if (this.isEmpty()) return null;
        let index = 0;
        let result = this.first() as R;
        for (const item of this.drop(1)) {
            result = operation(result, item, index++);
        }
        return result;
    }

    /**
     * Returns the size of the iterable wrapped by this sequence if said iterable is a sized 
     * collection (by implementing a length or size property). Otherwise, returns a negative number.
     */
    public size(): number {
        return this._size;
    }

    /**
     * If a predicate is provided, returns `true` if at least one element of this sequence fulfills
     * it. Otherwise, returns `true` if there is at least one element in this sequence.
     * This is short-circuiting terminal operation.
     */
    public some(): boolean;
    public some(predicate?: (item: T) => boolean): boolean;
    public some(predicate?: (item: T, index?: number) => boolean): boolean
    public some(predicate: (item: T, index: number) => boolean = _ => true): boolean {
        let index = 0;
        for (const item of this) {
            if (predicate(item, index++)) return true;
        }
        return false;
    }

    /**
     * Returns a new {@link Sequence} dropping all elements after the first `n`.
     * This operation is intermediate and stateful.\
     * \
     * The sequence created retains size information.
     */
    public take(n: number): Sequence<T> {
        return new (class TakeSequence extends Sequence<T> {
            override *[Symbol.iterator]() {
                let taken = 0;
                for (const item of this._values) {
                    if (taken++ < n) {
                        yield item;
                    }
                    else break;
                }
            }
        })(this, 
            this._size < 0          // if the current sequence is of unknown size,
                ? this._size        // the new sequence will also have unknown size.
                : n > this._size    // otherwise, if n is greater than the current size,
                    ? this._size    // 
                    : n
        );
    }

    /**
     * Returns a new {@link Sequence} dropping all elements after a predicate stops fulfilling for the
     * first time. This operation is intermediate and stateful.\
     * \
     * The sequence created is non-sized.
     */
    public takeWhile(predicate: (item: T) => boolean): Sequence<T>;
    public takeWhile(predicate: (item: T, index?: number) => boolean): Sequence<T>;
    public takeWhile(predicate: (item: T, index: number) => boolean): Sequence<T> {
        return new (class TakeWhileSequence extends Sequence<T> {
            override *[Symbol.iterator]() {
                let yielding = true;
                let index = 0;
                for (const item of this._values) {
                    if (!predicate(item, index++)) yielding = false;
                    if (!yielding) break;
                    yield item;
                }
            }
        })(this, -1);
    }

    /**
     * Returns an array containing the elements of this sequence. This is a terminal operation.
     */
    public toArray(): T[] {
        return this.fold<T[]>([], (acc, curr) => { acc.push(curr); return acc; });
    }

    /**
     * Returns a string representation of this sequence and its estimated size, which could be one
     * of the following:
     * - empty: Sequence (empty)
     * - an integer: Sequence (5)
     * - unknown size: Sequence (unknown)
     */
    public toString(): string {
        if (this.isEmpty()) return "Sequence (empty)";
        let sizeString: string = this.size() < 0
            ? "unknown" : (this.size()).toString(); 
        return `Sequence (${sizeString})`;
    }

    /**
     * Returns a generator yielding all values contained by this sequence.
     */
    *[Symbol.iterator](): Generator<T> {
        for (const value of this._values) yield value as any;
    }

    /**
     * ToString tag.
     */
    [Symbol.toStringTag]() { return "Sequence"; }
}

function isLenghted<T>(value: T): value is T & { length: number } {
    return typeof (value as any)["length"] === "number";
}

function isSized<T>(value: T): value is T & { size: number } {
    return typeof (value as any)["size"] === "number";
}