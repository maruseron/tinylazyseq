# TinyLazySeq

![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg?style=flat&logo=jest) ![Branches](https://img.shields.io/badge/branches-98.46%25-brightgreen.svg?style=flat&logo=jest) ![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=flat&logo=jest) ![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg?style=flat&logo=jest) *
<font size="1">\* Currently only Sequence and Utils classes count with testing. AsyncSequence testing is a bit trickier, so it will take longer.</font>

Small ES6 library that provides generator-based lazy sequences, allowing functional intermediate operation composition computed on demand. For more information, [here is the documentation](https://maruseron.github.io/tinylazyseq/).

## Tiny note of warning:

Although I couldn't find any errors before publishing this project, I have not intensely tested this library. As such, there is a slim chance you run into a bug. If so, please let me know and I'll publish a patch as soon as I can. This warning will stay here until I feel the library is perfectly safe _or_ I finally make a test suite for it.

## Getting Started

To add TinyLazySeq to your project, just run the following command in your project folder:

```
npm install tinylazyseq
```

## New in This Version

An instance method equivalent to the new `Map.groupBy` method in the [stage 4 array grouping proposal](https://github.com/tc39/proposal-array-grouping) has been added:

```typescript
const seq = Sequence.of(
    { name: "María", grade: 5.0 }, 
    { name: "Juan" , grade: 6.5 }, 
    { name: "Pedro", grade: 3.7 },
    { name: "María", grade: 7.0 });

seq.groupBy(item => item.name);
/* ^ Map {
         "María" => [ { "name": "María", "grade": 7.0 }, { "name": "María", "grade": 5.0 }],
         "Juan"  => [ { "name": "Juan" , "grade": 6.5 } ],
         "Pedro" => [ { "name": "Pedro", "grade": 3.7 } ]
     }
*/
```

However, no equivalent to the `Object.groupBy` method in the same proposal made it to the project. I consider using Objects as Maps very bad practice: frequent dynamic addition of keys degrades property access performance heavily, so one should try to mutate anonymous objects as little as possible. As such, I decided against adding the method.

## Laziness

The key difference between sequences and other iterables is their laziness - because of their lazy nature, sequences will do the minimal amount of work necessary to produce results, computing them on demand instead of eagerly producing the entire output.\
The drawback to this is that, overall, sequences are less performant than an eager collection when consuming the entire input. The advantage, however, is that lazy sequences won't halt the result production while all values get computed. To better explain what I mean, here's an example in pseudocode:

```js
var range = inclusiveRange(1, 10)

var list = range.toList()
var seq  = range.toSequence()

list.filter(num -> num % 2 == 0).map(num -> num * num)
seq.filter(num -> num % 2 == 0).map(num -> num * num)
```

These seemingly identical operations do, broadly, the same thing: they filter a collection of numbers from 1 to 10, keeping only even numbers, and then multiply those numbers by themselves. If we were to exhaust both collections with a forEach, we'd get the same output:

```js
list.forEach(print) // 4, 16, 36, 64, 100
seq.forEach(print)  // 4, 16, 36, 64, 100
```

However, if we add a log to each operation, we can clearly see the different nature of both approaches:

```js
list.filter(num -> { 
    print("filtering")
    return num % 2 == 0 
}).map(num -> {
    print("mapping")
    return num * num
})
/** output:
 * filtering, filtering, filtering, filtering, filtering
 * filtering, filtering, filtering, filtering, filtering
 * mapping, mapping, mapping, mapping, mapping
 */

seq.filter(num -> { 
    print("filtering")
    return num % 2 == 0 
}).map(num -> {
    print("mapping")
    return num * num
})
/** output:
 * none
 */

list.forEach(print) 
// 4, 16, 36, 64, 100

seq.forEach(print)
/** output:
 * filtering, filtering, mapping, 4
 * filtering, filtering, mapping, 16
 * filtering, filtering, mapping, 36 
 * filtering, filtering, mapping, 64
 * filtering, filtering, mapping, 100
 */
```

At this point, I hope I have done a good enough job of explaining the power of lazy sequences and intermediate operations. The List approach had all values immediately available after 15 operations, while the Sequence approach had the first value as soon as 3 operations.

## Factories

There are multiple ways of defining a sequence, but the two most commonly used are:

#### `Async/Sequence.of<T>(...args: T[]): Sequence<T>`

Creates a lazy sequence containing the provided arguments.

```ts
import { Sequence } from "tinylazyseq";
Sequence.of(1, 2, 3, 4, 5);
```

or an asynchronous one instead:

```ts
import { AsyncSequence } from "tinylazyseq";
AsyncSequence.of(promiseTask1(), promiseTask2(), promiseTask3());
```

#### `Async/Sequence.from<T>(iterable: Iterable<T>): Sequence<T>`

Creates a lazy sequence wrapping the provided iterable.

```ts
import { Sequence } from "tinylazyseq";
Sequence.from(getSomeIterableData());
```

or an asynchronous one instead

```ts
import { AsyncSequence } from "tinylazyseq";
AsyncSequence.from(getSomePromiseArray());
```

Since the rest of Sequence factories are as straightforward as these, I think the inline docs do a good enough job of explaining how they work.

## Single Iteration Constraints

TinyLazySeq supports Sequences made from iterators, as opposed to iterables, which can only be consumed once:

```ts
const iterator = someCustomIterator();

// this Sequence can only be iterated once
const seq = Sequence.from(iterator);

// we exhaust the Sequence through the forEach terminal operation
seq.map(someTransform).filter(somePredicate).forEach(console.log);

// calling another terminal operation results in an IllegalStateError
seq.fold(initial, reducer); 
//  ^ IllegalStateError: attempted to iterate a constrained sequence more than once
```

Iterable derived Sequences can also be constrained to one iteration, in Kotlin Sequence fashion:

```ts
const seq = Sequence.from([1, 2, 3, 4, 5]).constrainOnce();

// first() is terminal
console.log("first item!", seq.first());

// error, already consumed
seq.forEach(consumer);
//  ^ IllegalStateError: attempted to iterate a constrained sequence more than once
```

## API

A full description of all methods can be found [here](https://maruseron.github.io/tinylazyseq/).

The Sequence API is very similar to the Array API, so if you know how to use a functional approach with a JavaScript array, you pretty much already know how to use a Sequence. Here's a comparison table between Array and Sequence:

| Method or property | Array            | Sequence                             |
| ------------------ | ---------------- | ------------------------------------ |
| length             | yes              | no\*                                 |
| from               | yes              | yes                                  |
| of                 | yes              | yes                                  |
| at                 | yes              | no, but elementAt                    |
| concat             | yes              | yes                                  |
| contains           | no, but includes | yes                                  |
| containsAll        | no               | yes                                  |
| copyWithin         | yes              | no, immutable                        |
| count              | no               | yes                                  |
| drop               | no, but slice    | yes                                  |
| dropWhile          | no               | yes                                  |
| elementAt          | no, but at       | yes                                  |
| entries            | yes              | no                                   |
| every              | yes              | yes                                  |
| fill               | yes              | no, immutable                        |
| filter             | yes              | yes                                  |
| find               | yes              | yes                                  |
| findIndex          | yes              | yes                                  |
| findLast           | no               | yes                                  |
| findLastIndex      | no               | yes                                  |
| first              | no               | yes                                  |
| flat / flatten     | yes              | yes                                  |
| flatMap            | yes              | yes                                  |
| fold               | no, but reduce   | yes                                  |
| forEach            | yes              | yes                                  |
| includes           | yes              | no, but contains                     |
| indexOf            | yes              | yes                                  |
| isEmpty            | no               | yes                                  |
| join               | yes              | yes                                  |
| last               | no               | yes                                  |
| lastIndexOf        | yes              | yes                                  |
| map                | yes              | yes                                  |
| pop                | yes              | no, immutable                        |
| push               | yes              | no, immutable                        |
| reduce             | yes              | yes                                  |
| reduceRight        | yes              | no, can't be iterated backwards      |
| reverse            | yes              | no, immutable                        |
| shift              | yes              | no, immutable                        |
| size               | no, but length   | yes, partially                       |
| slice              | yes              | no, but drop and take                |
| some               | yes              | yes                                  |
| sort               | yes              | no, immutable                        |
| splice             | yes              | no, immutable                        |
| take               | no, but slice    | yes                                  |
| takeWhile          | no               | yes                                  |
| toLocaleString     | yes              | no                                   |
| toString           | yes              | yes, but does not provide the values |
| unshift            | yes              | no, immutable                        |
| values             | yes              | no                                   |
| Map.groupBy        | yes              | both: map static and instance method |
| Object.groupBy     | yes              | only object static (discouraged)     |

<font size="1">\* since Sequences describe possibly unsized and/or infinite collections, it is impossible to have a length property. Instead, sequences try to infer the size of the underlying collection from their available information (eg. the collection implements size or length), providing the size if they do so succesfully, or an integer smaller than zero if the size is unknown.</font>

## Contact

I'm easily contactable through Discord as maruseron. Not really active anywhere else.