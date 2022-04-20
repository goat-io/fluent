import Keyv from 'keyv'
export class Cache extends Keyv {
  public async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value ? true : false
  }
  /**
   * Get an item from the cache, or execute the given Closure and store the result.
   *
   * @param  string $key
   * @param  int  $ms - time in milliseconds
   * @param  $callback
   */
  public async remember(key: string, ms: number, fx: () => Promise<any>) {
    const value = await this.get(key)
    if (value) {
      return value
    }
    const result = await fx()
    await this.set(key, result, ms)
    return result
  }
  /**
   * Get an item from the cache, or execute the given Closure and store the result forever.
   *
   * @param  string  $key
   * @param  \Closure  $callback
   */
  public async rememberForever(key: string, fx: () => Promise<any>) {
    const value = await this.get(key)
    if (value) {
      return value
    }
    const result = await fx()
    await this.set(key, result)
    return result
  }
  /**
   * Retrieve an item from the cache and delete it.
   *
   * @param  string  $key
   */
  public async pull(key: string): Promise<any> {
    const value = await this.get(key)

    if (value) {
      this.delete(key)
    }
    return value
  }
  /**
   * Remove an item from the cache.
   *
   * @param  string  $key
   * @return bool
   */
  public async forget(key: string): Promise<boolean> {
    return await this.delete(key)
  }
  /**
   * Remove all items from the cache in the current namespace
   *
   * @return bool
   */
  public async flush(): Promise<void> {
    return await this.clear()
  }
}
