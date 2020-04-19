export const Functions = (() => {
  /**
   *
   * @param fn
   * @param time
   */
  const debounce = (fn: () => void, time: number) => {
    let timeout

    return function() {
      const functionCall = () => fn.apply(this, arguments)

      clearTimeout(timeout)
      timeout = setTimeout(functionCall, time)
    }
  }
  /**
   *
   * @param ms
   */
  const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  return Object.freeze({
    debounce,
    sleep
  })
})()
