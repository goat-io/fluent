import Utilities from '../utilities'

const Schedule = (() => {
  let Every = 0
  const every = milliseconds => {
    Every = milliseconds
    return this
  }
  const set = async cb => {
    if (Every === 0) {
      throw new Error(
        'You must asign a timeframe. Cannot Schedule every 0 milliseconds. Did you call function every()?'
      )
    }

    const rInterval = (callback, delay) => {
      const dateNow = Date.now
      const requestAnimation =
        typeof window !== 'undefined' && window.requestAnimationFrame
      let start = dateNow()
      let stop
      const intervalFunc = () => {
        // eslint-disable-next-line no-use-before-define
        if (dateNow() - start >= delay) {
          start += delay
          callback()
        }
        // eslint-disable-next-line no-use-before-define
        stop || requestAnimation(intervalFunc)
      }

      requestAnimation(intervalFunc)
      return {
        clear: () => {
          stop = 1
        }
      }
    }

    const DebouncedCallback = Utilities.debounce(cb, 2000)

    rInterval(DebouncedCallback, Every)
  }

  return Object.freeze({
    set,
    every
  })
})()

export default Schedule
