/**
 * Factory returning a function that converts a value string to n-grams.
 *
 * @param {number} n
 */
export function nGram(n: number) {
  if (
    typeof n !== 'number' ||
    Number.isNaN(n) ||
    n < 1 ||
    n === Number.POSITIVE_INFINITY
  ) {
    throw new Error(`\`${n}\` is not a valid argument for \`n-gram\``)
  }

  return grams

  /**
   * Create n-grams from a given value.
   *
   * @template {string|string[]} T
   * @param {T} [value]
   * @returns {T[]}
   */
  function grams(value: string) {
    /** @type {T[]} */
    const nGrams: string[] = []
    /** @type {number} */
    let index
    /** @type {string|string[]} */
    let source

    if (value === null || value === undefined) {
      return nGrams
    }

    source = value.length ? value : String(value)
    index = source.length - n + 1

    if (index < 1) {
      return nGrams
    }

    while (index--) {
      // @ts-ignore
      nGrams[index] = source.slice(index, index + n)
    }

    return nGrams
  }
}
