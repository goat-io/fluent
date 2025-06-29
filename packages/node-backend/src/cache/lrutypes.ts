export type ExpirableItem<T> = {
  // Timestamp in millis (like Date.now()) when this item is no longer usable.
  expires?: number
  data: T
}
export interface MapInterface {
  clear(): void
  delete(key: string): boolean
  get(key: string): any
  set(key: string, value: any, ttl: number): 1 | 0
}
