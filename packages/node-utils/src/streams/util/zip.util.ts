import { promisify } from 'node:util'
import { ZlibOptions, deflate, inflate, gzip, gunzip } from 'node:zlib'

const zDeflate = promisify(deflate)
const zInflate = promisify(inflate)
const zGzip = promisify(gzip)
const zGunzip = promisify(gunzip)

// string > compressed buffer

/**
 * deflateBuffer uses `deflate`.
 * It's 9 bytes shorter than `gzip`.
 */
export async function deflateBuffer(
  buf: Buffer,
  options: ZlibOptions = {}
): Promise<Buffer> {
  return await zDeflate(buf, options)
}

export async function inflateBuffer(
  buf: Buffer,
  options: ZlibOptions = {}
): Promise<Buffer> {
  return await zInflate(buf, options)
}

/**
 * deflateString uses `deflate`.
 * It's 9 bytes shorter than `gzip`.
 */
export async function deflateString(
  s: string,
  options?: ZlibOptions
): Promise<Buffer> {
  return await deflateBuffer(Buffer.from(s), options)
}

export async function inflateToString(
  buf: Buffer,
  options?: ZlibOptions
): Promise<string> {
  return (await inflateBuffer(buf, options)).toString()
}

/**
 * gzipBuffer uses `gzip`
 * It's 9 bytes longer than `deflate`.
 */
export async function gzipBuffer(
  buf: Buffer,
  options: ZlibOptions = {}
): Promise<Buffer> {
  return await zGzip(buf, options)
}

export async function gunzipBuffer(
  buf: Buffer,
  options: ZlibOptions = {}
): Promise<Buffer> {
  return await zGunzip(buf, options)
}

/**
 * gzipString uses `gzip`.
 * It's 9 bytes longer than `deflate`.
 */
export async function gzipString(
  s: string,
  options?: ZlibOptions
): Promise<Buffer> {
  return await gzipBuffer(Buffer.from(s), options)
}

export async function gunzipToString(
  buf: Buffer,
  options?: ZlibOptions
): Promise<string> {
  return (await gunzipBuffer(buf, options)).toString()
}
