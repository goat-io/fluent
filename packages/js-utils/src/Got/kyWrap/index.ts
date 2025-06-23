/*
 * NOTE(@raon0211):
 * ky-universal uses top-level await, preventing direct CJS conversion.
 * Thus, we create a separate index.server.ts file, adapting ky-universal's implementation to use require() only.
 *
 * @see https://github.com/sindresorhus/ky-universal/blob/main/index.js#L30
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
// import fetch, { Headers, Request, Response } from 'cross-fetch'
// import AbortController from 'abort-controller'
// @ts-ignore
import ky from 'ky'

// Only set polyfills in Node.js environment
// if (
//   typeof process !== 'undefined' &&
//   process.versions &&
//   process.versions.node
// ) {
//   if (!globalThis.fetch) {
//     // @ts-ignore
//     globalThis.fetch = (url, options) => fetch(url, { ...options })
//   }

//   if (!globalThis.Headers) {
//     globalThis.Headers = Headers
//   }

//   if (!globalThis.Request) {
//     // @ts-ignore
//     globalThis.Request = Request
//   }

//   if (!globalThis.Response) {
//     // @ts-ignore
//     globalThis.Response = Response
//   }

//   if (!globalThis.AbortController) {
//     // @ts-ignore
//     globalThis.AbortController = AbortController
//   }

//   if (!globalThis.ReadableStream) {
//     globalThis.ReadableStream = require('web-streams-polyfill/dist/ponyfill.js')
//   }
// }

export default ky
// @ts-ignore
export * from 'ky'
