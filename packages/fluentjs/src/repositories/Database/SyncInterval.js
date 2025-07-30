import Utilities from '../../utilities'
import Sync from './Sync'

const SyncInterval = (() => {
  async function set(milliseconds) {
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

    const DebouncedSync = Utilities.debounce(Sync.now, 2000)

    rInterval(DebouncedSync, milliseconds)
  }

  return Object.freeze({
    set
  })
})()

export default SyncInterval
