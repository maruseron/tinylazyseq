import { Utils } from "./Utils.js";

/**
 * Describes a lazily computed sequence of elements that can be synchronously iterated over, 
 * allowing for composition of intermediate operations in an efficient, on-demand execution order.
 * @typeParam T The type of the values contained by this sequence.
 */
export class Sequence<T> implements Iterable<T> {
    /**
     * The underlying Iterable contained by this sequence. The values are dispatched
     * through its iterator, so any type implementing the iterator symbol is fine.
     */
    protected readonly _values: Iterable<T>;
    /**
     * A cached size for sequences with available size information (eg. sequences made from an 
     * sized iterable, or sequences mapped from an already sized sequence). Less than 0 for 
     * non-deterministically sized sequences, like FilteringSequences.
     */
    protected readonly _size: number;
    protected constructor(iterable: Iterable<T>, size?: number) {
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
     * Creates a lazy sequence containing the provided arguments.\
     * The sequence created is sized (known).
     */
    public static of<T>(...args: T[]): Sequence<T> {
        return new Sequence(args, args.length);
    }

    /**
     * Creates a lazy sequence wrapping the provided iterable or iterator.\
     * If an `Iterable` is provided, the sequence created is sized, as long as the provided iterable 
     * has a `length` or `size` property. Otherwise, size is less than 0 (unknown).\
     * If an `Iterator` is provided, the sequence created is constrained to only one iteration and 
     * unsized, as it is impossible to know the size ahead of time.
     */
    public static from<T>(source: Iterable<T> | Iterator<T>): Sequence<T> {
        if (Utils.isIterator(source)) {
            return new ConstrainedSequence(source, -1);
        } else {
            return new Sequence(source);
        }
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
        return new GeneratorSequence(initial, nextValue);
    }

    /**
     * Returns a new {@link Sequence} containing the values of this sequence and the
     * one provided as an argument. This operation is intermediate and stateless.\
     * \
     * The created sequence will be sized if and only if both of the concatenated sequences are of
     * known size. Otherwise, size information is lost.
     */
    public concat(other: Sequence<T>): Sequence<T> {
        return new ConcatSequence(this, other);
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
     * Returns a new {@link Sequence} containing the elements in this sequence, constrained to only
     * one iteration. 
     */
    public constrainOnce(): Sequence<T> {
        return new ConstrainedSequence(this[Symbol.iterator](), this.size());
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
        return new DropSequence(this, n);
    }

    /**
     * Returns a new {@link Sequence} skipping the first n elements that fulfill a given predicate.
     * This operation is intermediate and stateful.\
     * \
     * The sequence created is non-sized.
     */
    public dropWhile(predicate: (item: T) => boolean): Sequence<T>;
    public dropWhile(predicate: (item: T, index?: number) => boolean): Sequence<T>;
    public dropWhile(predicate: (item: T, index?: number) => boolean): Sequence<T> {
        return new DropWhileSequence(this, predicate);
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
    public filter<S extends T>(predicate: (item: T) => item is S): Sequence<S>;
    public filter<S extends T>(predicate: (item: T, index?: number) => item is S): Sequence<S>;
    public filter<S extends T>(predicate: (item: T, index?: number) => boolean): Sequence<T> | Sequence<S> {
        return new FilteringSequence(this, predicate);
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
        return new FlatteningSequence(this);
    }

    /**
     * Returns a new {@link Sequence} flattening every sequence generated by the transformator function
     * by one level. This operation is intermediate and stateless.\
     * \
     * The sequence created is non-sized.
     */
    public flatMap<U>(transform: (item: T) => Sequence<U>): Sequence<U>;
    public flatMap<U>(transform: (item: T, index?: number) => Sequence<U>): Sequence<U>;
    public flatMap<U>(transform: (item: T, index?: number) => Sequence<U>): Sequence<U> {
        return new FlatmappingSequence(this, transform);
    }

    /**
     * Returns a value resulting from recursively applying an operation on an initial value and
     * the current value for every item of this sequence. This is a terminal operation. 
     */
    public fold<R>(initial: R, operation: (accumulator: R, current: T) => R): R;
    public fold<R>(initial: R, operation: (accumulator: R, current: T, index?: number) => R): R;
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
    public forEach(action: (item: T) => void): void;
    public forEach(action: (item: T, index?: number) => void): void;
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
    public join(): string;
    public join(options: { 
        separator?: string;
        prefix?: string;
        postfix?: string;
        limit?: number;
        truncated?: string;
        transform?: (item: T) => string;
    }): string;
    public join(options?: { 
        separator?: string;
        prefix?: string;
        postfix?: string;
        limit?: number;
        truncated?: string;
        transform?: (item: T) => string;
    }): string {
        const separator = options?.separator ?? ", ",
              prefix    = options?.prefix    ?? "",
              postfix   = options?.postfix   ?? "",
              limit     = options?.limit     ?? -1,
              truncated = options?.truncated ?? "...",
              transform = options?.transform;
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
     * Returns the last element contained by this sequence. 
     * This is a terminal operation.
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
    public map<U>(transform: (item: T, index?: number) => U): Sequence<U> {
        return new MapSequence(this, transform);
    }

    /**
     * Returns a value resulting from recursively applying an operation on the first element 
     * of this sequence and the current value for every item of this sequence after the first. 
     * This is a terminal operation. 
     */
    public reduce<R extends T>(operation: (accumulator: R, current: T) => R): R | null;
    public reduce<R extends T>(operation: (accumulator: R, current: T, index?: number) => R): R | null;
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
    public some(predicate?: (item: T, index?: number) => boolean): boolean;
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
        return new TakeSequence(this, n);
    }

    /**
     * Returns a new {@link Sequence} dropping all elements after a predicate stops fulfilling for the
     * first time. This operation is intermediate and stateful.\
     * \
     * The sequence created is non-sized.
     */
    public takeWhile(predicate: (item: T) => boolean): Sequence<T>;
    public takeWhile(predicate: (item: T, index?: number) => boolean): Sequence<T>;
    public takeWhile(predicate: (item: T, index?: number) => boolean): Sequence<T> {
        return new TakeWhileSequence(this, predicate);
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
        let sizeString = this.size() < 0
            ? "unknown" : this.size().toString(); 
        return `Sequence (${sizeString})`;
    }

    /**
     * Returns a generator yielding all values contained by this sequence.
     */
    *[Symbol.iterator](): Generator<T> {
        for (const value of this._values) yield value;
    }

    /**
     * ToString tag.
     */
    [Symbol.toStringTag]() { return "Sequence"; }
}

class GeneratorSequence<T> extends Sequence<T> {
    private readonly initial: T;
    private readonly nextValue: (current: T) => T | null;
    constructor(
        initial: T, 
        nextValue: (current: T) => T | null
    ) { 
        super([], -1); 
        this.initial = initial;
        this.nextValue = nextValue;
    }

    override *[Symbol.iterator]() {
        let current: T | null = this.initial;
        yield this.initial;
        while (current !== null) {
            if ((current = this.nextValue(current)) != null) {
                yield current;
            }
        }
    }
}

class ConcatSequence<T> extends Sequence<T> {
    private readonly other: Sequence<T>;
    constructor(
        sequence: Sequence<T>,
        other: Sequence<T>
    ) {
        if (sequence.size() < 0 || other.size() < 0) { super(sequence, -1); } 
        else { super(sequence, sequence.size() + other.size()); }
        this.other = other;
    }

    override *[Symbol.iterator]() {
        yield* this._values;
        yield* this.other["_values"]; // absolutely cursed. I know.
    }
}

class ConstrainedSequence<T> extends Sequence<T> {
    private readonly iterator: Iterator<T>;
    private iterated: boolean = false;
    constructor(iterator: Iterator<T>, size: number) {
        super([], size);
        this.iterator = iterator;
    }

    override *[Symbol.iterator]() {
        if (this.iterated) { 
            throw new Utils.IllegalStateError("attempted to iterate a constrained sequence more than once"); 
        }
        this.iterated = true;
        let next = this.iterator.next();
        while (!next.done) {
            try {
                yield next.value;
            } finally {
                next = this.iterator.next();
            }
        }
    }
}

class DropSequence<T> extends Sequence<T> {
    private readonly n: number;
    constructor(
        sequence: Sequence<T>,
        n: number
    ) { 
        if (sequence.size() < 0) { super(sequence, -1); } 
        else { super(sequence, sequence.size() - n < 0 ? 0 : sequence.size() - n); }
        this.n = n;
    }

    override *[Symbol.iterator]() {
        let dropped = 0;
        for (const value of this._values) {
            if (dropped++ >= this.n) {
                yield value;
            }
        }
    }
}

class DropWhileSequence<T> extends Sequence<T> {
    private readonly predicate: (item: T, index?: number) => boolean;
    constructor(
        sequence: Sequence<T>,
        predicate: (item: T, index?: number) => boolean
    ) { 
        super(sequence, -1); 
        this.predicate = predicate;
    }

    override *[Symbol.iterator]() {
        let yielding = false;
        let index = 0;
        for (const value of this._values) {
            if (!this.predicate(value, index++)) yielding = true;
            if (yielding) yield value;
        }
    }
}

class FilteringSequence<T> extends Sequence<T> {
    private readonly predicate: (item: T, index?: number) => boolean;
    constructor(
        sequence: Sequence<T>,
        predicate: (item: T, index?: number) => boolean
    ) {
        super(sequence, -1);
        this.predicate = predicate;
    }

    override *[Symbol.iterator]() {
        let index = 0;
        for (const value of this._values) {
            if (this.predicate(value, index++)) yield value;
        }
    }
}

class FlatteningSequence<T> extends Sequence<T> {
    constructor(sequence: Sequence<Sequence<T>>) { 
        super(sequence as any, -1); 
    }

    override *[Symbol.iterator]() {
        for (const value of this._values) {
            yield* value as any;
        }
    }
}

class FlatmappingSequence<T, U> extends Sequence<U> {
    private readonly transform: (item: T, index?: number) => Sequence<U>;
    constructor(
        sequence: Sequence<T>,
        transform: (item: T, index?: number) => Sequence<U>
    ) {
        super(sequence as any, -1);
        this.transform = transform;
    }

    override *[Symbol.iterator]() {
        let index = 0;
        for (const value of this._values) {
            yield* this.transform(value as any, index++);
        }
    }
}

class MapSequence<T, U> extends Sequence<U> {
    private readonly transform: (item: T, index?: number) => U;
    constructor(
        sequence: Sequence<T>,
        transform: (item: T, index?: number) => U
    ) {
        super(sequence as any, sequence.size());
        this.transform = transform;
    }

    override *[Symbol.iterator]() {
        let index = 0;
        for (const value of this._values) {
            yield this.transform(value as any, index++);
        }
    }
}

class TakeSequence<T> extends Sequence<T> {
    private readonly n: number;
    constructor(
        sequence: Sequence<T>,
        n: number
    ) {
        super(sequence, 
            sequence.size() < 0          // if the current sequence is of unknown size,
                ? -1                     // the new sequence will also have unknown size.
                : n > sequence.size()    // otherwise, if n is greater than the current size,
                    ? sequence.size()    // then the size will be the current size.
                    : n);                // else, n.
        this.n = n;
    }

    override *[Symbol.iterator]() {
        let taken = 0;
        for (const value of this._values) {
            if (taken++ < this.n) {
                yield value;
            }
            else break;
        }
    }
}

class TakeWhileSequence<T> extends Sequence<T> {
    private readonly predicate: (item: T, index?: number) => boolean;
    constructor(
        sequence: Sequence<T>,
        predicate: (item: T, index?: number) => boolean
    ) {
        super(sequence, -1);
        this.predicate = predicate;
    }

    override *[Symbol.iterator]() {
        let yielding = true;
        let index = 0;
        for (const value of this._values) {
            if (!this.predicate(value, index++)) yielding = false;
            if (!yielding) break;
            yield value;
        }
    }
}