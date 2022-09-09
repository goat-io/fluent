class NumbersClass {
  /**
   * Checks if the given string can be
   * parsed as a number
   * @param str
   * @returns
   */
  isNumeric = (str: string): boolean =>
    !isNaN(parseFloat(str)) && isFinite(Number(str))

  /**
   * Converts a string into a number if the given
   * string could be properly parsed
   * @param str
   * @returns
   */
  parseStringToNumber = (str: string): string | number => {
    if (this.isNumeric(str)) {
      return parseFloat(str)
    }
    return str.trim()
  }

  randomInt(minIncluding: number, maxIncluding: number): number {
    return Math.floor(
      Math.random() * (maxIncluding - minIncluding + 1) + minIncluding
    )
  }

  toFixed(n: number, fractionDigits: number): number {
    return Number(n.toFixed(fractionDigits))
  }

  /**
   * Same as .toPrecision(), but conveniently casts the output to Number.
   *
   * @example
   *
   * _toPrecision(1634.56, 1)
   * // 2000
   *
   * _toPrecision(1634.56, 2)
   * // 1600
   */
  toPrecision(n: number, precision: number): number {
    return Number(n.toPrecision(precision))
  }

  round(n: number, precisionUnit: number): number {
    if (precisionUnit >= 1) {
      return Math.round(n / precisionUnit) * precisionUnit
    }

    const v =
      Math.floor(n) + Math.round((n % 1) / precisionUnit) * precisionUnit
    return Number(v.toFixed(String(precisionUnit).length - 2)) // '0.
  }

  average(values: number[]): number {
    return values.reduce((a, b) => a + b) / values.length
  }

  averageOrNull(values: number[] | undefined | null): number | null {
    return values?.length
      ? values.reduce((a, b) => a + b) / values.length
      : null
  }

  /**
   * valuesArray and weightsArray length is expected to be the same.
   */
  averageWeighted(values: number[], weights: number[]): number {
    const numerator = values
      .map((value, i) => value * weights[i]!)
      .reduce((a, b) => a + b)

    const denominator = weights.reduce((a, b) => a + b)

    return numerator / denominator
  }

  sortNumbers(numbers: number[], mutate = false, descending = false): number[] {
    const mod = descending ? -1 : 1
    return (mutate ? numbers : [...numbers]).sort((a, b) => (a - b) * mod)
  }

  /**
   * @example
   *
   * _percentile([1, 2, 3, 4], 50)
   * // 2.5
   *
   * _percentile([1, 2, 3], 50)
   * // 2
   *
   * _percentile([1, 2, 3], 100)
   * // 3
   */
  percentile(values: number[], pc: number): number {
    const sorted = this.sortNumbers(values)

    // Floating pos in the range of [0; length - 1]
    const pos = ((values.length - 1) * pc) / 100
    const dec = pos % 1
    const floorPos = Math.floor(pos)
    const ceilPos = Math.ceil(pos)

    return this.averageWeighted(
      [sorted[floorPos]!, sorted[ceilPos]!],
      [1 - dec, dec]
    )
  }

  /**
   * A tiny bit more efficient function than calling _percentile individually.
   */
  percentiles(values: number[], pcs: number[]): Record<number, number> {
    const r = {} as Record<number, number>

    const sorted = this.sortNumbers(values)

    pcs.forEach(pc => {
      // Floating pos in the range of [0; length - 1]
      const pos = ((values.length - 1) * pc) / 100
      const dec = pos % 1
      const floorPos = Math.floor(pos)
      const ceilPos = Math.ceil(pos)

      r[pc] = this.averageWeighted(
        [sorted[floorPos]!, sorted[ceilPos]!],
        [1 - dec, dec]
      )
    })

    return r
  }

  median(values: number[]): number {
    return this.percentile(values, 50)
  }

  humanCount(c = 0): string {
    if (c < 10 ** 4) return String(c)
    if (c < 10 ** 6) return (c / 10 ** 3).toPrecision(3) + ' K'
    if (c < 10 ** 9) return (c / 10 ** 6).toPrecision(3) + ' M' // million
    if (c < 10 ** 12) return (c / 10 ** 9).toPrecision(3) + ' B' // billion
    if (c < 10 ** 15) return (c / 10 ** 12).toPrecision(3) + ' T' // trillion
    return Math.round(c / 10 ** 12) + ' T'
  }
}
export const Numbers = new NumbersClass()
