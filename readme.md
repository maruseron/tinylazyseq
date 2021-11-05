# TinyLazySeq

Small ES6 library that provides generator-based lazy sequences, allowing functional intermediate operation composition computed on demand. For more information, [here is the documentation](https://maruseron.github.io/tinylazyseq/classes/Sequence.html).

## Tiny note of warning:
Although I couldn't find any errors before publishing this project, I have not intensely tested this library. As such, there is a slim chance you run into a bug. If so, please let me know and I'll publish a patch as soon as I can. This warning will stay here until I feel the library is perfectly safe _or_ I finally make a test suite for it.

## Getting Started
To add TinyLazySeq to your project, just run the following command in your project folder:
```
npm install tinylazyseq
```
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

### `Sequence.of<T>(...args: T[]): Sequence<T>`
Creates a lazy sequence containing the provided arguments.
```ts
import { Sequence } from "tinylazyseq";
Sequence.of(1, 2, 3, 4, 5);
```

### `Sequence.from<T>(iterable: Iterable<T>): Sequence<T>`
Creates a lazy sequence wrapping the provided iterable.
```ts
import { Sequence } from "tinylazyseq";
const data = getSomeIterableData();
Sequence.from(data);
```

Since the rest of Sequence factories are as straightforward as these, I think the inline docs do a good enough job of explaining how they work.

## API
A full description of all methods can be found [here](https://maruseron.github.io/tinylazyseq/classes/Sequence.html).

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

<font size="1">\* since Sequences describe possibly unsized and/or infinite collections, it is impossible to have a length property. Instead, sequences try to infer the size of the underlying collection from their available information (eg. the collection implements size or length), providing the size if they do so succesfully, or an integer smaller than zero if the size is unknown.</font>

## Contact
I'm easily contactable through Discord as maruseron#4476. Not really active anywhere else.