export const Arrays = (() => {
  /**
   * Return the first element in an array or the default.
   *
   * @param  iterable  array
   * @param  mixed  def
   * @return mixed
   */
  const first = (arr: any, def?: any): any => {
    if (arr && Array.isArray(arr) && arr[0]) {
      return arr[0]
    }
    return def
  }
  /**
   * Return the last element in an array.
   *
   * @param  array  $array
   * @param  callable|null  $callback
   * @param  mixed  $default
   * @return mixed
   */
  const last = (arr: any, def?: any): any => {
    if (arr && Array.isArray(arr) && arr[arr.length - 1]) {
      return arr[arr.length - 1]
    }
    return def
  }
  /**
   *
   * @param xs
   * @param f
   */
  const groupBy = (xs, f) => {
    return xs.reduce(
      (r, v, i, a, k = f(v)) => ((r[k] || (r[k] = [])).push(v), r),
      {}
    )
  }
  /**
   *
   * @param data
   * @param size
   */
  const chunk = (data: any[], size: number) => {
    const results: any[][] = []
    const elements = [...data]

    while (elements.length) {
      results.push(elements.splice(0, size))
    }

    return results
  }
  /**
   *
   * @param data
   */
  const collapse = (data: any[][]) => {
    const elements = [...data]
    const results: any[] = []

    elements.forEach(c => {
      if (Array.isArray(c)) {
        c.forEach(element => {
          results.push(element)
        })
      } else {
        results.push(c)
      }
    })

    return results
  }
  /**
   *
   * @param data
   */
  const deDuplicate = (data: any[]) => {
    return [...new Set(data)]
  }

  return Object.freeze({
    first,
    last,
    groupBy,
    chunk,
    collapse,
    deDuplicate
  })
})()
