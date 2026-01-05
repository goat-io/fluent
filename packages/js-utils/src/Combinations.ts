/**
 * combinatorics.js
 *
 *  Licensed under the MIT license.
 *  http://www.opensource.org/licenses/mit-license.php
 *
 *  @author: Dan Kogai <dankogai+github@gmail.com>
 *
 *  References:
 *  @link: http://www.ruby-doc.org/core-2.0/Array.html#method-i-combination
 *  @link: http://www.ruby-doc.org/core-2.0/Array.html#method-i-permutation
 *  @link: http://en.wikipedia.org/wiki/Factorial_number_system
 */
export const version = '1.4.2'
/**
 * BigInt Workaround
 *
 * https://github.com/streamich/memfs/issues/275
 */
type Anyint = number | bigint
/**
 * Optional<T> will not be official so
 * @link: https://github.com/microsoft/TypeScript/issues/19944
 */
type Optional<T> = T | undefined
// type BigInt = number;
declare const BigIntPolyfill: typeof Number
const Bi = typeof BigInt === 'function' ? BigInt : Number
/**
 * crops BigInt
 */
const Crop = (n: Anyint): Anyint =>
  n <= Number.MAX_SAFE_INTEGER ? Number(n) : Bi(n)

/**
 * Safe arithmetic operations for mixed number/bigint types
 */
const SafeArith = {
  multiply: (a: Anyint, b: Anyint): Anyint => {
    const aVal = Bi(a)
    const bVal = Bi(b)
    if (typeof aVal === 'bigint' || typeof bVal === 'bigint') {
      return (aVal as bigint) * (bVal as bigint)
    }
    return (aVal as number) * (bVal as number)
  },

  divide: (a: Anyint, b: Anyint): Anyint => {
    const aVal = Bi(a)
    const bVal = Bi(b)
    if (typeof aVal === 'bigint' || typeof bVal === 'bigint') {
      return (aVal as bigint) / (bVal as bigint)
    }
    return (aVal as number) / (bVal as number)
  },

  modulo: (a: Anyint, b: Anyint): Anyint => {
    const aVal = Bi(a)
    const bVal = Bi(b)
    if (typeof aVal === 'bigint' || typeof bVal === 'bigint') {
      return (aVal as bigint) % (bVal as bigint)
    }
    return (aVal as number) % (bVal as number)
  },

  subtract: (a: Anyint, b: Anyint): Anyint => {
    const aVal = Bi(a)
    const bVal = Bi(b)
    if (typeof aVal === 'bigint' || typeof bVal === 'bigint') {
      return (aVal as bigint) - (bVal as bigint)
    }
    return (aVal as number) - (bVal as number)
  },

  shiftLeft: (a: Anyint, b: Anyint): Anyint => {
    const aVal = Bi(a)
    const bVal = Bi(b)
    if (typeof aVal === 'bigint' || typeof bVal === 'bigint') {
      return (aVal as bigint) << (bVal as bigint)
    }
    return (aVal as number) << (bVal as number)
  },

  shiftRight: (a: Anyint, b: Anyint): Anyint => {
    const aVal = Bi(a)
    const bVal = Bi(b)
    if (typeof aVal === 'bigint' || typeof bVal === 'bigint') {
      return (aVal as bigint) >> (bVal as bigint)
    }
    return (aVal as number) >> (bVal as number)
  },

  bitwiseAnd: (a: Anyint, b: Anyint): Anyint => {
    const aVal = Bi(a)
    const bVal = Bi(b)
    if (typeof aVal === 'bigint' || typeof bVal === 'bigint') {
      return (aVal as bigint) & (bVal as bigint)
    }
    return (aVal as number) & (bVal as number)
  },
}
/**
 * calculates `P(n, k)`.
 *
 * @link https://en.wikipedia.org/wiki/Permutation
 */
export function permutation(n: Anyint, k: Anyint) {
  if (0 === k) {
    return 1
  }
  if (n < k) {
    return 0
  }
  let nBi = Bi(n)
  let kBi = Bi(k)
  let p = Bi(1)
  while (kBi > 0) {
    p = SafeArith.multiply(p, nBi)
    nBi = typeof nBi === 'bigint' ? nBi - 1n : nBi - 1
    kBi = typeof kBi === 'bigint' ? kBi - 1n : kBi - 1
  }
  return Crop(p)
}
/**
 * calculates `C(n, k)`.
 *
 * @link https://en.wikipedia.org/wiki/Combination
 */
export function combination(n: Anyint, k: Anyint) {
  if (0 === k) {
    return 1
  }
  if (n === k) {
    return 1
  }
  if (n < k) {
    return 0
  }
  const P = permutation
  const c = SafeArith.divide(Bi(P(n, k)), Bi(P(k, k)))
  return Crop(c)
}
/**
 * calculates `n!` === `P(n, n)`.
 *
 * @link https://en.wikipedia.org/wiki/Factorial
 */
export function factorial(n: Anyint) {
  return permutation(n, n)
}
/**
 * returns the factoradic representation of `n`, least significant order.
 *
 * @link https://en.wikipedia.org/wiki/Factorial_number_system
 * @param {number} l the number of digits
 */
export function factoradic(n: Anyint, l = 0) {
  if (n < 0) {
    return undefined
  }
  let [bn, bf] = [Bi(n), Bi(1)]
  let length = l
  if (!length) {
    for (
      length = 1;
      bf < bn;
      length++, bf = SafeArith.multiply(bf, Bi(length))
    ) {
      // Intentionally empty - loop is used to calculate length
    }
    if (bn < bf) {
      length--
      bf = SafeArith.divide(bf, Bi(length))
    }
  } else {
    bf = Bi(factorial(length))
  }
  const digits = [0]
  for (; length; length--, bf = SafeArith.divide(bf, Bi(length))) {
    digits[length] = Math.floor(Number(SafeArith.divide(bn, bf)))
    bn = SafeArith.modulo(bn, bf)
  }
  return digits
}
/**
 * `combinadic(n, k)` returns a function
 * that takes `m` as an argument and
 * returns the combinadics representation of `m` for `n C k`.
 *
 * @link https://en.wikipedia.org/wiki/Combinatorial_number_system
 */
export function combinadic(n: number, k: number) {
  const count = combination(n, k)
  return (m: Anyint): number[] => {
    if (m < 0 || count <= m) {
      throw new Error('Uneven number of elements')
    }
    const digits = []
    let [a, b] = [n, k]
    let x = SafeArith.subtract(SafeArith.subtract(Bi(count), Bi(1)), Bi(m))
    for (let i = 0; i < k; i++) {
      a--
      while (x < combination(a, b)) {
        a--
      }
      digits.push(n - 1 - a)
      x = SafeArith.subtract(x, Bi(combination(a, b)))
      b--
    }
    return digits
  }
}
/**
 *
 */
const Crypto: any = typeof crypto !== 'undefined' ? crypto : {}
const RandomBytes: (len: number) => Uint8Array =
  typeof Crypto.randomBytes === 'function'
    ? (len: number) => Uint8Array.from(Crypto.randomBytes(len))
    : typeof Crypto.getRandomValues === 'function'
      ? (len: number) => Crypto.getRandomValues(new Uint8Array(len))
      : (len: number) => Uint8Array.from(Array(len), () => Math.random() * 256)
/**
 * returns random integer `n` where `min` <= `n` < `max`:
 *
 * if the argument is `BigInt` the result is also `BigInt`.
 *
 * @param {anyint} min
 * @param {anyint} max
 */
export function randomInteger(...args: [min?: Anyint, max?: Anyint]) {
  let min: Anyint = args[0] ?? 0
  let max: Anyint = args[1] ?? 2 ** 53
  const ctor = min.constructor
  if (args.length === 0) {
    return Math.floor(Math.random() * ctor(max))
  }
  if (args.length === 1) {
    ;[min, max] = [ctor(0), min]
  }
  if (typeof min === 'number') {
    // number
    ;[min, max] = [Math.ceil(Number(min)), Math.ceil(Number(max))]
    return Math.floor(Math.random() * (max - min)) + min
  }
  const mag = ctor(max) - ctor(min)
  const len = mag.toString(16).length
  const u8s = RandomBytes(len)
  const rnd = u8s.reduce((a, v) => (a << ctor(8)) + ctor(v), ctor(0))
  return ((ctor(rnd) * mag) >> ctor(len * 8)) + ctor(min)
}
/**
 * Base Class of `js-combinatorics`
 */
class CBase {
  /**
   * does `new`
   * @param args
   */
  static of(...args: any[]): unknown {
    return new (Function.prototype.bind.apply(CBase, [null, ...args]))()
  }
  /**
   * Same as `of` but takes a single array `arg`
   *
   * cf. https://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible
   */
  static from(arg: any[]): unknown {
    return new (Function.prototype.bind.apply(CBase, [null, ...arg]))()
  }
  /**
   * Common iterator
   */
  [Symbol.iterator]() {
    return (function* (it, len) {
      for (let i = 0; i < len; i++) {
        yield it.nth(i)
      }
    })(this, this.length)
  }
  /**
   * returns `[...this]`.
   */
  toArray() {
    return [...this]
  }
  /**
   * tells wether you need `BigInt` to access all elements.
   */
  get isBig() {
    return Number.MAX_SAFE_INTEGER < this.length
  }
  /**
   * tells wether it is safe to work on this instance.
   *
   * * always `true` unless your platform does not support `BigInt`.
   * * if not, `true` iff `.isBig` is `false`.
   */
  get isSafe() {
    return typeof BigInt !== 'undefined' || !this.isBig
  }
  nth(_n: Anyint): Optional<any[]> {
    return []
  }
  seed: any[]
  size: number
  length: Anyint
  /**
   * Checks if the given index is within bounds
   */
  check(n: Anyint): Optional<number> {
    const validN = Number(n)
    if (validN < 0 || validN >= Number(this.length)) {
      return undefined
    }
    return validN
  }
  sample(): Optional<any[]> {
    return this.nth(randomInteger(this.length))
  }
  samples() {
    return (function* (it) {
      while (true) {
        yield it.sample()
      }
    })(this)
  }
}
/**
 * Permutation
 */
export class Permutation extends CBase {
  constructor(seed: Iterable<any>, size = 0) {
    super()
    this.seed = [...seed]
    this.size = 0 < size && size <= this.seed.length ? size : this.seed.length
    this.length = permutation(this.seed.length, this.size)
    Object.freeze(this)
  }
  nth(n: Anyint): Optional<any[]> {
    const checked = this.check(n)
    if (checked === undefined) {
      return undefined
    }
    const validN = checked
    const offset = this.seed.length - this.size
    const skip = factorial(offset)
    const digits = factoradic(
      SafeArith.multiply(Bi(validN), Bi(skip)),
      this.seed.length,
    )
    if (!digits) {
      return undefined
    }
    const source = this.seed.slice()
    const result = []
    for (let i = this.seed.length - 1; offset <= i; i--) {
      const index = digits[i]
      if (typeof index === 'number') {
        result.push(source.splice(index, 1)[0])
      }
    }
    return result
  }
}
/**
 * Combination
 */
export class Combination extends CBase {
  comb: (index: Anyint) => number[]
  constructor(seed: Iterable<any>, size = 0) {
    super()
    this.seed = [...seed]
    this.size = 0 < size && size <= this.seed.length ? size : this.seed.length
    this.length = combination(this.seed.length, this.size)
    this.comb = combinadic(this.seed.length, this.size)
    Object.freeze(this)
  }
  nth(n: Anyint): Optional<any[]> {
    const checked = this.check(n)
    if (checked === undefined) {
      return undefined
    }
    const validN = checked
    return this.comb(validN).reduce((a, v) => a.concat(this.seed[v]), [])
  }
}
/**
 * Base N
 */
export class BaseN extends CBase {
  base: number
  constructor(seed: Iterable<any>, size = 1) {
    super()
    this.seed = [...seed]
    this.size = size
    const base = this.seed.length
    this.base = base
    const length =
      size < 1
        ? 0
        : Array(size)
            .fill(Bi(base))
            .reduce((a, v) => a * v)
    this.length = Crop(length)
    Object.freeze(this)
  }
  nth(n: Anyint): Optional<any[]> {
    const checked = this.check(n)
    if (checked === undefined) {
      return undefined
    }
    const validN = checked
    let bn = Bi(validN)
    const bb = Bi(this.base)
    const result = []
    for (let i = 0; i < this.size; i++) {
      const bd = SafeArith.modulo(bn, bb)
      result.push(this.seed[Number(bd)])
      bn = SafeArith.subtract(bn, bd)
      bn = SafeArith.divide(bn, bb)
    }
    return result
  }
}
/**
 * Power Set
 */
export class PowerSet extends CBase {
  constructor(seed: Iterable<any>) {
    super()
    this.seed = [...seed]
    const length = SafeArith.shiftLeft(Bi(1), Bi(this.seed.length))
    this.length = Crop(length)
    Object.freeze(this)
  }
  nth(n: Anyint): Optional<any[]> {
    const checked = this.check(n)
    if (checked === undefined) {
      return undefined
    }
    const validN = checked
    let bn = Bi(validN)
    const result = []
    for (
      let bi = Bi(0);
      bn;
      bn = SafeArith.shiftRight(bn, Bi(1)),
        bi = typeof bi === 'bigint' ? bi + 1n : bi + 1
    ) {
      if (SafeArith.bitwiseAnd(bn, Bi(1))) {
        result.push(this.seed[Number(bi)])
      }
    }
    return result
  }
}
/**
 * Cartesian Product
 */
export class CartesianProduct extends CBase {
  constructor(...args: Iterable<any>[]) {
    super()
    this.seed = args.map(v => [...v])
    this.size = this.seed.length
    const length = this.seed.reduce(
      (a, v) => SafeArith.multiply(a, Bi(v.length)),
      Bi(1),
    )
    this.length = Crop(length)
    Object.freeze(this)
  }
  nth(n: Anyint): Optional<any[]> {
    const checked = this.check(n)
    if (checked === undefined) {
      return undefined
    }
    const validN = checked
    let bn = Bi(validN)
    const result = []
    for (let i = 0; i < this.size; i++) {
      const base = this.seed[i].length
      const bb = Bi(base)
      const bd = SafeArith.modulo(bn, bb)
      result.push(this.seed[i][Number(bd)])
      bn = SafeArith.subtract(bn, bd)
      bn = SafeArith.divide(bn, bb)
    }
    return result
  }
}
