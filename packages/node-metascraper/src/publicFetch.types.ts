import type { IncomingHttpHeaders } from 'node:http'
export type PublicResponse = {
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
}
export type PinnedRequest = {
  url: URL
  address: string
  maxBytes: number
  signal: AbortSignal
}
export type PublicFetchOptions = {
  timeoutMs?: number
  maxBytes?: number
  resolve?: (hostname: string) => Promise<string[]>
  send?: (request: PinnedRequest) => Promise<PublicResponse>
}
