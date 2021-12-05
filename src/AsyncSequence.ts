import { Utils } from "./Utils.js";

// todo?: replace [a-z]*\s\|\sPromise<[a-z]*> with MaybePromise<[a-z]*>

type AwaitableIterable<T> = Iterable<Promise<T>> | AsyncIterable<T>;
type AwaitableIterator<T> = Iterator<Promise<T>> | AsyncIterator<T>;

/**
 * Describes a lazily computed sequence of elements that can be asynchronously iterated over,
 * allowing for composition of intermediate operations in an efficient, on-demand execution order.
 * @typeParam T The type of the values contained by this sequence.
 */
export class AsyncSequence<T> implements AsyncIterable<T> {
    /**
     * The underlying asynchronous iterable contained by this sequence. The values are dispatched
     * through its iterator, so any type implementing the asynciterator symbol or having Promises as
     * their parameterized type is fine.
     */
     protected readonly _values: AwaitableIterable<T>;
    /**
     * A cached size for sequences with available size information (eg. sequences made from a
     * sized iterable, or sequences mapped from an already sized sequence).\
     * \
     * Not of much use for AsyncSequences, since most sized iterables are collections, which don't 
     * tend to be asynchronous. Still, a couple cases like `Promise<T>[]` are sized.\
     * Remains here mostly for API consistency. Less than 0 for non-deterministically sized 
     * sequences, like FilteringSequences.
     */
    protected readonly _size: number;
    protected constructor(iterable: AwaitableIterable<T>, size?: number) {
        this._values = iterable;
        if (size !== undefined) {
            this._size = size;
        } else {
            if (Utils.isLenghted(iterable)) {
                this._size = iterable.length;
            } else if (Utils.isSized(iterable)) {
                this._size = iterable.size;
            } 
            else this._size = -1;
        }
    }

    /**
     * Creates an asynchronous lazy sequence containing the provided arguments.\
     * The sequence created is sized (known).
     */
    public static of<T>(...args: Promise<T>[]): AsyncSequence<T> {
        return new AsyncSequence(args, args.length);
    }

    /**
     * Creates an asynchronous lazy sequence wrapping the provided iterable.
     * The sequence created is sized if the provided iterable has a `length` or `size` property.\
     * Otherwise, size is less than 0 (unknown).
     */
    public static from<T>(source: AwaitableIterable<T> | AwaitableIterator<T>): AsyncSequence<T> {
        if (Utils.isIterator<Promise<T>>(source)) {
            return new AsyncConstrainedSequence(source, -1);
        } else {
            return new AsyncSequence(source as Iterable<Promise<T>> | AsyncIterable<T>);
        }
    }

    /**
     * Creates an asynchronous lazy sequence containing no elements.\
     * The sequence created is sized (0).
     */
    public static empty<T>(): AsyncSequence<T> {
        return new AsyncSequence([], 0);
    }

    /**
     * Creates an asynchronous lazy sequence whose elements are generated by the recursive
     * application of `nextValue` on `initial` until `nextValue` returns `null`.\
     * The sequence created is non-sized (unknown).
     */
    public static generate<T>(initial: Promise<T>, nextValue: (current: T) => T | Promise<T> | null): AsyncSequence<T> {
        return new AsyncGeneratorSequence(initial, nextValue);
    }

    /**
     * Returns a new {@link AsyncSequence} containing the values of this sequence and the one
     * provided as an argument. This operation is intermediate and stateless.\
     * \
     * The created sequence will be sized if and only if both of the concatenated sequences are of
     * known size. Otherwise, size information is lost.
     */
    public concat(other: AsyncSequence<T>): AsyncSequence<T> {
        return new AsyncConcatSequence(this, other);
    }

    /**
     * Returns a promise resolving to true if `value` is identical to one contained by this sequence.
     * This is a short-circuiting terminal operation.
     */
    public async contains(value: T): Promise<boolean> {
        for await (const item of this) {
            if (item === value) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns a promise resolving to true if all the values in `values` are contained by this 
     * sequence. This is a short-circuiting terminal operation.
     */
    public async containsAll(values: Iterable<T>): Promise<boolean> {
        for await (const value of values) {
            if (!this.contains(value)) {
                return false;
            }
        }
        return true;
    }

    /**
     * If a predicate is provided, returns a promise resolving to the amount of elements in this
     * sequence that fulfilled it. Otherwise, resolved to the the amount of elements in this 
     * sequence. This is a terminal operation.
     */
    public async count(): Promise<number>;
    public async count(predicate: (item: T) => boolean | Promise<boolean>): Promise<number>;
    public async count(predicate: (item: T, index?: number) => boolean | Promise<boolean>): Promise<number>;
    public async count(predicate: (item: T, index: number) => boolean | Promise<boolean> = _ => Promise.resolve(true)): Promise<number> {
        let index = 0;
        let count = 0;
        for await (const item of this) {
            if (await predicate(item, index++)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Returns a new {@link AsyncSequence} skipping the first `n` elements.
     * This operation is intermediate and stateful.\
     * \
     * The sequence created retains size information.
     */
    public drop(n: number): AsyncSequence<T> {
        return new AsyncDropSequence(this, n);
    }

    /**
     * Returns a new {@link AsyncSequence} skipping the first n elements that fulfill a given 
     * asynchronous predicate.
     * This operation is intermediate and stateful.\
     * \
     * The sequence created is non-sized.
     */
    public dropWhile(predicate: (item: T) => boolean | Promise<boolean>): AsyncSequence<T>;
    public dropWhile(predicate: (item: T, index?: number) => boolean | Promise<boolean>): AsyncSequence<T>;
    public dropWhile(predicate: (item: T, index?: number) => boolean | Promise<boolean>): AsyncSequence<T> {
        return new AsyncDropWhileSequence(this, predicate);
    }

    /**
     * Returns a promise resolving to the element at `index`, or to undefined if the index is out of
     * bounds. Since {@link AsyncSequence}s are not a Random Access collection, this operation is 
     * O(n). This is a short-circuiting terminal operation.
     */
    public async elementAt(index: number): Promise<T | undefined> {
        if (index < 0) return undefined;
        let count = 0;
        for await (const item of this) {
            if (index === count++) return item;
        }
        return undefined;
    }

    /**
     * Returns a promise resolving to true if all elements in this sequence fulfill the given 
     * asynchronous predicate. This is a short-circuiting terminal operation.
     */
    public async every(predicate: (item: T) => boolean | Promise<boolean>): Promise<boolean>;
    public async every(predicate: (item: T, index?: number) => boolean | Promise<boolean>): Promise<boolean>;
    public async every(predicate: (item: T, index?: number) => boolean | Promise<boolean>): Promise<boolean> {
        let index = 0;
        for await (const item of this) {
            if (!(await predicate(item, index++))) return false;
        }
        return true;
    }

    /**
     * Returns a new {@link AsyncSequence} keeping the elements in this sequence that fulfill the
     * given asynchronous predicate.
     * This operation is intermediate and stateless.\
     * \
     * The sequence created is non-sized.
     */
    public filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncSequence<T>;
    public filter(predicate: (item: T, index?: number) => boolean | Promise<boolean>): AsyncSequence<T>;
    public filter<S extends T>(predicate: (item: T) => boolean | Promise<boolean>): AsyncSequence<S>;
    public filter<S extends T>(predicate: (item: T, index?: number) => boolean | Promise<boolean>): AsyncSequence<S>;
    public filter<S extends T>(predicate: (item: T, index?: number) => boolean | Promise<boolean>): AsyncSequence<T> | AsyncSequence<S> {
        return new AsyncFilteringSequence(this, predicate);
    }

    /**
     * Returns a promise resolving to the first item fulfilling an asynchronous predicate, or to 
     * undefined if none does. This is a short-circuiting terminal operation.
     */
    public async find(predicate: (item: T) => boolean | Promise<boolean>): Promise<T | undefined>;
    public async find(predicate: (item: T, index?: number) => boolean | Promise<boolean>): Promise<T | undefined>;
    public async find(predicate: (item: T, index?: number) => boolean | Promise<boolean>): Promise<T | undefined> {
        let index = 0;
        for await (const item of this) {
            if (await predicate(item, index++)) return item;
        }
        return undefined;
    }

    /**
     * Returns a promise resolving to the index of the first item fulfilling an asynchronous 
     * predicate, or to -1 if none does. This is a short-circuiting terminal operation.
     */
    public async findIndex(predicate: (item: T) => boolean | Promise<boolean>): Promise<number> {
        let index = 0;
        for await (const item of this) {
            if (predicate(item)) return index;
            index++;
        }
        return -1;
    }

    /**
     * Returns a promise resolving to the last item fulfilling an asynchronous predicate, or to
     * undefined if none does. This is a terminal operation.
     */
    public async findLast(predicate: (item: T) => boolean | Promise<boolean>): Promise<T | undefined>;
    public async findLast(predicate: (item: T, index?: number) => boolean | Promise<boolean>): Promise<T | undefined>;
    public async findLast(predicate: (item: T, index?: number) => boolean | Promise<boolean>): Promise<T | undefined> {
        let index = 0;
        let result: T | undefined;
        for await (const item of this) {
            if (await predicate(item, index++)) result = item;
        }
        return result;
    }

    /**
     * Returns a promise resolving to the index of the last item fulfilling an asynchronous 
     * predicate, or to -1 if none does. This is a terminal operation.
     */
    public async findLastIndex(predicate: (item: T) => boolean | Promise<boolean>): Promise<number> {
        let result = -1;
        let current = 0;
        for await (const item of this) {
            if (await predicate(item)) result = current;
            current++;
        }
        return result;
    }

    /**
     * Returns a promise resolving to the first element of this sequence, or to undefined if it's 
     * empty. This is a short-circuiting terminal operation and it does not hang for infinite 
     * sequences.
     */
    public async first(): Promise<T | undefined> {
        for await (const item of this) return item;
        return undefined;
    }

    /**
     * Returns a new {@link AsyncSequence} flattening every inner sequence of this collection by one
     * level. This operation is intermediate and stateless.\
     * \
     * The sequence created is non-sized.
     */
    public flatten<T>(this: AsyncSequence<AsyncSequence<T>>): AsyncSequence<T> {
        return new AsyncFlatteningSequence(this);
    }

    /**
     * Returns a new {@link AsyncSequence} flattening every sequence generated by the asynchronous
     * transformator function by one level. This operation is intermediate and stateless.\
     * \
     * The sequence created is non-sized.
     */
    public flatMap<U>(transform: (item: T) => AsyncSequence<U> | Promise<AsyncSequence<U>>): AsyncSequence<U>;
    public flatMap<U>(transform: (item: T, index?: number) => AsyncSequence<U> | Promise<AsyncSequence<U>>): AsyncSequence<U>;
    public flatMap<U>(transform: (item: T, index?: number) => AsyncSequence<U> | Promise<AsyncSequence<U>>): AsyncSequence<U> {
        return new AsyncFlatmappingSequence(this, transform);
    }

    /**
     * Returns a promise resolving to the value resulting from recursively applying an asynchronous 
     * operation on an initial value and the current value for every item of this sequence. 
     * This is a terminal operation. 
     */
    public async fold<R>(initial: R, operation: (accumulator: R, current: T) => R | Promise<R>): Promise<R>;
    public async fold<R>(initial: R, operation: (accumulator: R, current: T, index?: number) => R | Promise<R>): Promise<R>;
    public async fold<R>(initial: R, operation: (accumulator: R, current: T, index?: number) => R | Promise<R>): Promise<R> {
        let index = 0;
        let result = initial;
        for await (const item of this) {
            result = await operation(result, item, index++);
        }
        return result;
    }

    /**
     * Returns an empty promise performing an asynchronous operation on every item of this sequence.
     * This is a terminal operation.
     */
    public async forEach(action: (item: T) => void | Promise<void>): Promise<void>;
    public async forEach(action: (item: T, index?: number) => void | Promise<void>): Promise<void>;
    public async forEach(action: (item: T, index?: number) => void | Promise<void>): Promise<void> {
        let index = 0;
        for await (const item of this) {
            await action(item, index++);
        }
    }

    /**
     * Returns a promise resolving to the the index of the first item of this sequence `value` is 
     * identical to. If there is none, resolves to -1. This is a short-circuiting terminal operation.
     */
    public async indexOf(value: T): Promise<number> {
        let index = 0;
        for await (const item of this) {
            if (item === value) return index;
            index++;
        }
        return -1;
    }

    /**
     * Returns a promise resolving to true if this collection contains no elements. This is a 
     * short-circuiting terminal operation and it does not hang for infinite sequences.
     */
    public async isEmpty(): Promise<boolean> {
        for await (const _ of this) return false;
        return true;
    }

    /**
     * Returns a promise resolving to a string representation of this sequence. 
     * This is a terminal operation.
     */
    public async join(): Promise<string>;
    public async join(options: { 
        separator?: string; 
        prefix?: string; 
        postfix?: string; 
        limit?: number; 
        truncated?: string; 
        transform?: (item: T) => string | Promise<string>; 
    }): Promise<string>;
    public async join(options?: { 
        separator?: string; 
        prefix?: string; 
        postfix?: string; 
        limit?: number; 
        truncated?: string; 
        transform?: (item: T) => string | Promise<string>; 
    }): Promise<string> {
        const separator = options?.separator ?? ", ",
              prefix    = options?.prefix    ?? "",
              postfix   = options?.postfix   ?? "",
              limit     = options?.limit     ?? -1,
              truncated = options?.truncated ?? "...",
              transform = options?.transform;
        let base: string = prefix;
        let count = 0;
        for await (const item of this) {
            if (++count > 1) base += separator;
            if (limit < 0 || count <= limit) {
                if (transform) {
                    base += await transform(item);
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
     * Returns a promise resolving to the last element contained by this sequence. 
     * This is a terminal operation.
     */
    public async last(): Promise<T | undefined> {
        let result: T | undefined;
        for await (const item of this) {
            result = item;
        }
        return result;
    }

    /**
     * Returns a promise resolving to the index of the last element of this sequence `value` is 
     * identical to, or to -1 if none is. This is a terminal operation.
     */
    public async lastIndexOf(value: T): Promise<number> {
        let result = -1;
        let index = 0;
        for await (const item of this) {
            if (item === value) result = index;
            index++;
        }
        return result;
    }

    /**
     * Returns a new {@link AsyncSequence} asynchronously transforming each value of this sequence.
     * This operation is intermediate and stateless.\
     * \
     * The sequence created retains size information.
     */
    public map<U>(transform: (item: T) => U | Promise<U>): AsyncSequence<U>;
    public map<U>(transform: (item: T, index?: number) => U | Promise<U>): AsyncSequence<U>;
    public map<U>(transform: (item: T, index?: number) => U | Promise<U>): AsyncSequence<U> {
        return new AsyncMapSequence(this, transform);
    }

    /**
     * Returns a promise resolving to a value resulting from recursively applying an asynchronous
     * operation on the first element of this sequence and the current value for every item of this 
     * sequence after the first. This is a terminal operation. 
     */
    public async reduce<R extends T>(operation: (accumulator: R, current: T) => R | Promise<R>): Promise<R | null>;
    public async reduce<R extends T>(operation: (accumulator: R, current: T, index?: number) => R | Promise<R>): Promise<R | null>;
    public async reduce<R extends T>(operation: (accumulator: R, current: T, index?: number) => R | Promise<R>): Promise<R | null> {
        if (await this.isEmpty()) return null;
        let index = 0;
        let result = await this.first() as R;
        for await (const item of this.drop(1)) {
            result = await operation(result, item, index++);
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
     * If a predicate is provided, returns a promise resolving to `true` if at least one element of 
     * this sequence fulfills it. Otherwise, returns a promise resolving to `true` if there is at 
     * least one element in this sequence. This is short-circuiting terminal operation.
     */
    public async some(): Promise<boolean>;
    public async some(predicate?: (item: T) => boolean | Promise<boolean>): Promise<boolean>;
    public async some(predicate?: (item: T, index?: number) => boolean | Promise<boolean>): Promise<boolean>;
    public async some(predicate: (item: T, index?: number) => boolean | Promise<boolean> = _ => true): Promise<boolean> {
        let index = 0;
        for await (const item of this) {
            if (await predicate(item, index++)) return true;
        }
        return false;
    }

    /**
     * Returns a new {@link AsyncSequence} dropping all elements after the first `n`.
     * This operation is intermediate and stateful.\
     * \
     * The sequence created retains size information.
     */
    public take(n: number): AsyncSequence<T> {
        return new AsyncTakeSequence(this, n);
    }

    /**
     * Returns a new {@link AsyncSequence} dropping all elements after an asynchronous predicate 
     * stops fulfilling for the first time. This operation is intermediate and stateful.\
     * \
     * The sequence created is non-sized.
     */
    public takeWhile(predicate: (item: T) => boolean | Promise<boolean>): AsyncSequence<T>;
    public takeWhile(predicate: (item: T, index?: number) => boolean | Promise<boolean>): AsyncSequence<T>;
    public takeWhile(predicate: (item: T, index?: number) => boolean | Promise<boolean>): AsyncSequence<T> {
        return new AsyncTakeWhileSequence(this, predicate);
    }

    /**
     * Returns a promise resolving to an array containing the elements of this sequence. 
     * This is a terminal operation.
     */
    public async toArray(): Promise<T[]> {
        return this.fold<T[]>([], (acc, curr) => { acc.push(curr); return acc; });
    }

    /**
     * Returns a string representation of this sequence and its estimated size, which could be one
     * of the following:
     * - 0: Sequence (empty)
     * - an integer: Sequence (5)
     * - unknown size: Sequence (unknown)
     */
    public toString(): string {
        if (this._size === 0) return "AsyncSequence (empty)";
        let sizeString = this.size() < 0
            ? "unknown" : this.size().toString();
        return `AsyncSquence (${sizeString})`;
    }

    /**
     * Returns an asynchronous generator yielding all values contained by this sequence.
     */
    async *[Symbol.asyncIterator](): AsyncGenerator<T> {
        for await (const value of this._values) yield value;
    }

    /**
     * ToString tag.
     */
    [Symbol.toStringTag](): string { return "AsyncSequence"; }
}

class AsyncGeneratorSequence<T> extends AsyncSequence<T> {
    private readonly initial: Promise<T>;
    private readonly nextValue: (current: T) => T | Promise<T> | null
    constructor(
        initial: Promise<T>,
        nextValue: (current: T) => T | Promise<T> | null 
    ) {
        super([], -1);
        this.initial = initial;
        this.nextValue = nextValue;
    }

    override async *[Symbol.asyncIterator]() {
        let current: T | null = await this.initial;
        yield current;
        while (current !== null) {
            if ((current = await this.nextValue(current)) != null) {
                yield current;
            }
        }
    }
}

class AsyncConcatSequence<T> extends AsyncSequence<T> {
    private readonly other: AsyncSequence<T>;
    constructor(
        sequence: AsyncSequence<T>,
        other: AsyncSequence<T>
    ) {
        if (sequence.size() < 0 || other.size() < 0) { super(sequence, -1); }
        else { super(sequence, sequence.size() + other.size()); }
        this.other = other;
    }

    override async *[Symbol.asyncIterator]() {
        yield* this._values;
        yield* this.other["_values"];
    }
}

class AsyncConstrainedSequence<T> extends AsyncSequence<T> {
    private readonly iterator: AwaitableIterator<T>;
    private iterated: boolean = false;
    constructor(iterator: AwaitableIterator<T>, size: number) {
        super([], size);
        this.iterator = iterator;
    }

    override async *[Symbol.asyncIterator]() {
        if (this.iterated) {
            throw new Utils.IllegalStateError("attempted to iterate a constrained sequence more than once");
        }
        this.iterated = true;
        let next = await this.iterator.next();
        while (!next.done) {
            try {
                yield next.value;
            } finally {
                next = await this.iterator.next();
            }
        }
    }
}

class AsyncDropSequence<T> extends AsyncSequence<T> {
    private readonly n: number;
    constructor(
        sequence: AsyncSequence<T>,
        n: number
    ) {
        if (sequence.size() < 0) { super(sequence, -1); }
        else { super(sequence, sequence.size() - n < 0 ? 0 : sequence.size() - n); }
        this.n = n;
    }

    override async *[Symbol.asyncIterator]() {
        let dropped = 0;
        for await (const value of this._values) {
            if (dropped++ >= this.n) {
                yield value;
            }
        }
    }
}

class AsyncDropWhileSequence<T> extends AsyncSequence<T> {
    private readonly predicate: (item: T, index?: number) => boolean | Promise<boolean>;
    constructor(
        sequence: AsyncSequence<T>,
        predicate: (item: T, index?: number) => boolean | Promise<boolean>
    ) {
        super(sequence, -1);
        this.predicate = predicate;
    }

    override async *[Symbol.asyncIterator]() {
        let yielding = false;
        let index = 0;
        for await (const value of this._values) {
            if (!(await this.predicate(value, index++))) yielding = true;
            if (yielding) yield value;
        }
    }
}

class AsyncFilteringSequence<T> extends AsyncSequence<T> {
    private readonly predicate: (item: T, index?: number) => boolean | Promise<boolean>;
    constructor(
        sequence: AsyncSequence<T>,
        predicate: (item: T, index?: number) => boolean | Promise<boolean>
    ) {
        super(sequence, -1);
        this.predicate = predicate;
    }

    override async *[Symbol.asyncIterator]() {
        let index = 0;
        for await (const value of this._values) {
            if (await this.predicate(value, index++)) yield value;
        }
    }
}

class AsyncFlatteningSequence<T> extends AsyncSequence<T> {
    constructor(sequence: AsyncSequence<AsyncSequence<T>>) {
        super(sequence as any, -1);
    }

    override async *[Symbol.asyncIterator]() {
        for await (const value of this._values) {
            yield* value as any;
        }
    }
}

class AsyncFlatmappingSequence<T, U> extends AsyncSequence<U> {
    private readonly transform: (item: T, index?: number) => AsyncSequence<U> | Promise<AsyncSequence<U>>;
    constructor(
        sequence: AsyncSequence<T>,
        transform: (item: T, index?: number) => AsyncSequence<U> | Promise<AsyncSequence<U>>
    ) {
        super(sequence as any, -1);
        this.transform = transform;
    }

    override async *[Symbol.asyncIterator]() {
        let index = 0;
        for await (const value of this._values) {
            yield* await this.transform(value as any, index++);
        }
    }
}

class AsyncMapSequence<T, U> extends AsyncSequence<U> {
    private readonly transform: (item: T, index?: number) => U | Promise<U>;
    constructor(
        sequence: AsyncSequence<T>,
        transform: (item: T, index?: number) => U | Promise<U>
    ) {
        super(sequence as any, sequence.size());
        this.transform = transform;
    }

    override async *[Symbol.asyncIterator]() {
        let index = 0;
        for await (const value of this._values) {
            yield this.transform(value as any, index++);
        }
    }
}

class AsyncTakeSequence<T> extends AsyncSequence<T> {
    private readonly n: number;
    constructor(
        sequence: AsyncSequence<T>,
        n: number
    ) {
        super(sequence,
            sequence.size() < 0         // if the current sequence is of unknown size,
                ? -1                    // the new sequence will also have unknown size.
                : n > sequence.size()   // otherwise, if n is greater than the current size,
                    ? sequence.size()   // then the size will be the current size.
                    : n);               // else, n.
        this.n = n;
    }

    override async *[Symbol.asyncIterator]() {
        let taken = 0;
        for await (const value of this._values) {
            if (taken++ < this.n) yield value;
            else break;
        }
    }
}

class AsyncTakeWhileSequence<T> extends AsyncSequence<T> {
    private readonly predicate: (item: T, index?: number) => boolean | Promise<boolean>;
    constructor(
        sequence: AsyncSequence<T>,
        predicate: (item: T, index?: number) => boolean | Promise<boolean>
    ) {
        super(sequence, -1);
        this.predicate = predicate;
    }

    override async *[Symbol.asyncIterator]() {
        let yielding = true;
        let index = 0;
        for await (const value of this._values) {
            if (!(await this.predicate(value, index++))) yielding = false;
            if (!yielding) break;
            yield value;
        }
    }
}