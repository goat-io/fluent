// Add polyfills for Node.js globals in jsdom environment
import { TextEncoder, TextDecoder } from 'util'

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as any
}

// Add fetch polyfill if needed
if (typeof globalThis.fetch === 'undefined') {
  // Vitest provides fetch in jsdom environment, but just in case
  const { fetch, Headers, Request, Response } = require('undici')
  globalThis.fetch = fetch
  globalThis.Headers = Headers
  globalThis.Request = Request
  globalThis.Response = Response
}

export {}
