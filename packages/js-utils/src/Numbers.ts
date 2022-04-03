export const Numbers = (() => {
  /**
   * Checks if the given string can be
   * parsed as a number
   * @param str
   * @returns
   */
  const isNumeric = (str: string): boolean =>
    !isNaN(parseFloat(str)) && isFinite(Number(str))
  /**
   * Converts a string into a number if the given
   * string could be properly parsed
   * @param str
   * @returns
   */
  const parseStringToNumber = (str: string): string | number => {
    if (isNumeric(str)) {
      return parseFloat(str)
    }
    return str.trim()
  }
  return Object.freeze({ isNumeric, parseStringToNumber })
})()
