export const Functions = () => {
  /**
   *
   * @param {*} fn
   * @param {*} time
   */
  const debounce = (fn, time) => {
    let timeout

    return function() {
      const functionCall = () => fn.apply(this, arguments)

      clearTimeout(timeout)
      timeout = setTimeout(functionCall, time)
    }
  }
  return Object.freeze({
    debounce
  })
}
