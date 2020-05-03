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

  return Object.freeze({
    first,
    last
  })
})()
