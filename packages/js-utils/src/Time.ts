class TimeClass {
  since(from: number, until = Date.now()): string {
    return this.ms(until - from)
  }

  ms(millis: number): string {
    // <1 sec
    if (millis < 1000) return `${Math.round(millis)} ms`

    // < 5 sec
    if (millis < 5000) return `${(millis / 1000).toFixed(3)} sec`

    const sec = Math.floor(millis / 1000) % 60
    const min = Math.floor(millis / (60 * 1000)) % 60
    const hrs = Math.floor(millis / (3600 * 1000))

    // <1 hr
    if (hrs === 0) {
      // <1 min
      if (min === 0) return `${sec} sec`

      return `${min}m${sec}s`
    }

    if (hrs < 24) {
      return `${hrs}h${min}m`
    }

    if (hrs < 48) {
      return `${Math.round(hrs + min / 60)}h`
    }

    // >= 48 hours

    const days = Math.floor(hrs / 24)
    return `${days} days`
  }
}

export const Time = new TimeClass()
