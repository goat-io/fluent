import { randomBytes } from 'node:crypto'

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'

/** Generate a URL-safe random ID (same as nanoid). Default 21 chars. */
export function nanoId(size = 21): string {
  const bytes = randomBytes(size)
  let id = ''
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i] & 63]
  }
  return id
}
