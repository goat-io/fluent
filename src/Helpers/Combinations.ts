/**
 * BigInt Workaround
 *
 * https://github.com/streamich/memfs/issues/275
 */
type anyint = number | bigint
/**
 * Optional<T> will not be official so
 * @link: https://github.com/microsoft/TypeScript/issues/19944
 */
type Optional<T> = T | undefined
// type BigInt = number;
declare const BigInt: typeof Number
const _BI: typeof Number = typeof BigInt == 'function' ? BigInt : Number
/**
 * crops BigInt
 */
const _crop = (n: anyint): anyint =>
  n <= Number.MAX_SAFE_INTEGER ? Number(n) : _BI(n)
/**
 * calculates `P(n, k)`.
 *
 * @link https://en.wikipedia.org/wiki/Permutation
 */
export function permutation(n: anyint, k: anyint) {
  if (n < 0) throw new RangeError(`negative n is not acceptable`)
  if (k < 0) throw new RangeError(`negative k is not acceptable`)
  if (0 == k) return 1
  if (n < k) return 0
  ;[n, k] = [_BI(n), _BI(k)]
  let p = _BI(1)
  while (k--) p *= n--
  return _crop(p)
}
/**
 * calculates `C(n, k)`.
 *
 * @link https://en.wikipedia.org/wiki/Combination
 */
export function combination(n: anyint, k: anyint) {
  if (0 == k) return 1
  if (n == k) return 1
  if (n < k) return 0
  const P = permutation
  const c = _BI(P(n, k)) / _BI(P(k, k))
  return _crop(c)
}
/**
 * calculates `n!` === `P(n, n)`.
 *
 * @link https://en.wikipedia.org/wiki/Factorial
 */
export function factorial(n: anyint) {
  return permutation(n, n)
}
/**
 * returns the factoradic representation of `n`, least significant order.
 *
 * @link https://en.wikipedia.org/wiki/Factorial_number_system
 * @param {number} l the number of digits
 */
export function factoradic(n: anyint, l = 0) {
  if (n < 0) return undefined
  let [bn, bf] = [_BI(n), _BI(1)]
  if (!l) {
    for (l = 1; bf < bn; bf *= _BI(++l));
    if (bn < bf) bf /= _BI(l--)
  } else {
    bf = _BI(factorial(l))
  }
  let digits = [0]
  for (; l; bf /= _BI(l--)) {
    digits[l] = Math.floor(Number(bn / bf))
    bn %= bf
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
  return (m: anyint): number[] => {
    if (m < 0 || count <= m) return undefined
    let digits = []
    let [a, b] = [n, k]
    let x = _BI(count) - _BI(1) - _BI(m)
    for (let i = 0; i < k; i++) {
      a--
      while (x < combination(a, b)) a--
      digits.push(n - 1 - a)
      x -= _BI(combination(a, b))
      b--
    }
    return digits
  }
}
/**
 *
 */
const _crypto = typeof crypto !== 'undefined' ? crypto : {}
const _randomBytes: (len: number) => Uint8Array =
  typeof _crypto['randomBytes'] === 'function'
    ? (len: number) => Uint8Array.from(_crypto['randomBytes'](len))
    : typeof _crypto['getRandomValues'] === 'function'
    ? (len: number) => _crypto['getRandomValues'](new Uint8Array(len))
    : (len: number) => Uint8Array.from(Array(len), () => Math.random() * 256)
/**
 * returns random integer `n` where `min` <= `n` < `max`:
 *
 * if the argument is `BigInt` the result is also `BigInt`.
 *
 * @param {anyint} min
 * @param {anyint} max
 */
export function randomInteger(min: anyint = 0, max: anyint = Math.pow(2, 53)) {
  let ctor = min.constructor
  if (arguments.length === 0) {
    return Math.floor(Math.random() * ctor(max))
  }
  if (arguments.length == 1) {
    ;[min, max] = [ctor(0), min]
  }
  if (typeof min == 'number') {
    // number
    ;[min, max] = [Math.ceil(Number(min)), Math.ceil(Number(max))]
    return Math.floor(Math.random() * (max - min)) + min
  }
  const mag = ctor(max) - ctor(min)
  const len = mag.toString(16).length
  const u8s = _randomBytes(len)
  const rnd = u8s.reduce((a, v) => (a << ctor(8)) + ctor(v), ctor(0))
  return ((ctor(rnd) * mag) >> ctor(len * 8)) + ctor(min)
}
/**
 * Base Class of `js-combinatorics`
 */
class _CBase<T, U> {
  /**
   * does `new`
   * @param args
   */
  static of(...args) {
    return new (Function.prototype.bind.apply(this, [null].concat(args)))()
  }
  /**
   * Same as `of` but takes a single array `arg`
   *
   * cf. https://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible
   */
  static from(arg) {
    return new (Function.prototype.bind.apply(this, [null].concat(arg)))()
  }
  /**
   * Common iterator
   */
  [Symbol.iterator]() {
    return (function* (it, len) {
      for (let i = 0; i < len; i++) yield it.nth(i)
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
  /**
   * check n for nth
   */
  _check(n: anyint): Optional<anyint> {
    if (n < 0) {
      if (this.length < -n) return undefined
      return _crop(_BI(this.length) + _BI(n))
    }
    if (this.length <= n) return undefined
    return n
  }
  /**
   * get the `n`th element of the iterator.
   * negative `n` goes backwards
   */
  nth(n: anyint): Optional<U[]> {
    return []
  }
  /**
   * the seed iterable
   */
  seed: T[]
  /**
   * the size (# of elements) of each element.
   */
  size: number
  /**
   * the number of elements
   */
  length: anyint
  /**
   * pick random element
   */
  sample(): Optional<U[]> {
    return this.nth(randomInteger(this.length))
  }
  /**
   * an infinite steam of random elements
   */
  samples() {
    return (function* (it) {
      while (true) yield it.sample()
    })(this)
  }
}
/**
 * Permutation
 */
export class Permutation<T> extends _CBase<T, T> {
  constructor(seed: Iterable<T>, size = 0) {
    super()
    this.seed = [...seed]
    this.size = 0 < size ? size : this.seed.length
    this.length = permutation(this.seed.length, this.size)
    Object.freeze(this)
  }
  nth(n: anyint): Optional<T[]> {
    n = this._check(n)
    if (n === undefined) return undefined
    const offset = this.seed.length - this.size
    const skip = factorial(offset)
    let digits = factoradic(_BI(n) * _BI(skip), this.seed.length)
    let source = this.seed.slice()
    let result = []
    for (let i = this.seed.length - 1; offset <= i; i--) {
      result.push(source.splice(digits[i], 1)[0])
    }
    return result
  }
}
/**
 * Combination
 */
export class Combination<T> extends _CBase<T, T> {
  comb: (anyint) => number[]
  constructor(seed: Iterable<T>, size = 0) {
    super()
    this.seed = [...seed]
    this.size = 0 < size ? size : this.seed.length
    this.size = size
    this.length = combination(this.seed.length, this.size)
    this.comb = combinadic(this.seed.length, this.size)
    Object.freeze(this)
  }
  /**
   * returns an iterator which is more efficient
   * than the default iterator that uses .nth
   *
   * @link https://en.wikipedia.org/wiki/Combinatorial_number_system#Applications
   */
  bitwiseIterator() {
    // console.log('overriding _CBase');
    const ctor = this.length.constructor
    const [zero, one, two] = [ctor(0), ctor(1), ctor(2)]
    const inc = x => {
      const u = x & -x
      const v = u + x
      return v + (((v ^ x) / u) >> two)
    }
    let x = (one << ctor(this.size)) - one // 0b11...1
    return (function* (it, len) {
      for (let i = 0; i < len; i++, x = inc(x)) {
        var result = []
        for (let y = x, j = 0; zero < y; y >>= one, j++) {
          if (y & one) result.push(it.seed[j])
        }
        // console.log(`x = ${x}`);
        yield result
      }
    })(this, this.length)
  }
  nth(n: anyint): Optional<T[]> {
    n = this._check(n)
    if (n === undefined) return undefined
    return this.comb(n).reduce((a, v) => a.concat(this.seed[v]), [])
  }
}
/**
 * Base N
 */
// tslint:disable-next-line: max-classes-per-file
export class BaseN<T> extends _CBase<T, T> {
  base: number
  constructor(seed: Iterable<T>, size = 1) {
    super()
    this.seed = [...seed]
    this.size = size
    let base = this.seed.length
    this.base = base
    let length =
      size < 1
        ? 0
        : Array(size)
            .fill(_BI(base))
            .reduce((a, v) => a * v)
    this.length = _crop(length)
    Object.freeze(this)
  }
  nth(n: anyint): Optional<T[]> {
    n = this._check(n)
    if (n === undefined) return undefined
    let bn = _BI(n)
    const bb = _BI(this.base)
    let result = []
    for (let i = 0; i < this.size; i++) {
      var bd = bn % bb
      result.push(this.seed[Number(bd)])
      bn -= bd
      bn /= bb
    }
    return result
  }
}
/**
 * Power Set
 */
// tslint:disable-next-line: max-classes-per-file
export class PowerSet<T> extends _CBase<T, T> {
  constructor(seed: Iterable<T>) {
    super()
    this.seed = [...seed]
    const length = _BI(1) << _BI(this.seed.length)
    this.length = _crop(length)
    Object.freeze(this)
  }
  nth(n: anyint): Optional<T[]> {
    n = this._check(n)
    if (n === undefined) return undefined
    let bn = _BI(n)
    let result = []
    for (let bi = _BI(0); bn; bn >>= _BI(1), bi++)
      if (bn & _BI(1)) result.push(this.seed[Number(bi)])
    return result
  }
}
/**
 * Cartesian Product
 */
// tslint:disable-next-line: max-classes-per-file
export class CartesianProduct<T> extends _CBase<T[], T> {
  constructor(...args: Iterable<T>[]) {
    super()
    this.seed = args.map(v => [...v])
    this.size = this.seed.length
    const length = this.seed.reduce((a, v) => a * _BI(v.length), _BI(1))
    this.length = _crop(length)
    Object.freeze(this)
  }
  nth(n: anyint): Optional<T[]> {
    n = this._check(n)
    if (n === undefined) return undefined
    let bn = _BI(n)
    let result = []
    for (let i = 0; i < this.size; i++) {
      const base = this.seed[i].length
      const bb = _BI(base)
      const bd = bn % bb
      result.push(this.seed[i][Number(bd)])
      bn -= bd
      bn /= bb
    }
    return result
  }
}
