export const Functions = (() => {
  /**
   *
   * @param f
   */
  const requestAnimationFrame = f => {
    setImmediate(() => f(Date.now()))
  }
  /**
   *
   * @param fn
   * @param time
   */
  const debounce = (fn: () => void, time: number) => {
    let timeout

    return function () {
      const functionCall = () => fn.apply(this, arguments)

      clearTimeout(timeout)
      timeout = setTimeout(functionCall, time)
    }
  }
  /**
   *
   * @param ms
   */
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  /**
   *
   * @param cb
   */
  const repeatEvery = async (ms: number, callback: () => void) => {
    const dateNow = Date.now
    const requestAnimation =
      (typeof window !== 'undefined' && window.requestAnimationFrame) ||
      requestAnimationFrame

    let start = dateNow()
    let stop

    const intervalFunc = () => {
      // tslint:disable-next-line: no-unused-expression
      dateNow() - start < ms || ((start += ms), callback())
      // tslint:disable-next-line: no-unused-expression
      stop || requestAnimation(intervalFunc)
    }

    requestAnimation(intervalFunc)
    return {
      clear: () => {
        stop = 1
      }
    }
  }

  return Object.freeze({
    debounce,
    sleep,
    repeatEvery
  })
})()
