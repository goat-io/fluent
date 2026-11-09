import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'
import type {
  PinnedRequest,
  PublicFetchOptions,
  PublicResponse,
} from './publicFetch.types.js'

export function isPublicAddress(value: string): boolean {
  try {
    let address = ipaddr.parse(value)
    if (
      address.kind() === 'ipv6' &&
      (address as ipaddr.IPv6).isIPv4MappedAddress()
    ) {
      address = (address as ipaddr.IPv6).toIPv4Address()
    }
    return address.range() === 'unicast'
  } catch {
    return false
  }
}

function parseTarget(value: string): URL {
  const url = new URL(value)
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error('Unsafe preview URL')
  }
  url.hash = ''
  return url
}

export function sendPinned(input: PinnedRequest): Promise<PublicResponse> {
  return new Promise((resolve, reject) => {
    const family = isIP(input.address) as 4 | 6
    const request = input.url.protocol === 'https:' ? httpsRequest : httpRequest
    const req = request(
      input.url,
      {
        signal: input.signal,
        family,
        lookup: (_host, _options, callback) =>
          callback(null, input.address, family),
        // Keep the URL hostname for Host/SNI and normal certificate verification.
        headers: {
          'User-Agent': 'Goatlab-LinkPreview/1.0',
          Accept: '*/*',
          'Accept-Encoding': 'identity',
        },
      },
      response => {
        const status = response.statusCode ?? 0
        if ([301, 302, 303, 307, 308].includes(status)) {
          resolve({ status, headers: response.headers, body: Buffer.alloc(0) })
          response.destroy()
          return
        }
        const encoding = response.headers['content-encoding']
        if (encoding && encoding !== 'identity') {
          response.destroy()
          reject(new Error('Unsupported preview content encoding'))
          return
        }
        const declared = response.headers['content-length']
        if (declared && Number(declared) > input.maxBytes) {
          response.destroy()
          reject(new Error('Preview response exceeds byte limit'))
          return
        }
        let size = 0
        const chunks: Buffer[] = []
        response.on('error', reject)
        response.on('aborted', () =>
          reject(new Error('Preview response aborted')),
        )
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > input.maxBytes) {
            response.destroy()
            req.destroy()
            reject(new Error('Preview response exceeds byte limit'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () =>
          resolve({
            status,
            headers: response.headers,
            body: Buffer.concat(chunks, size),
          }),
        )
      },
    )
    req.on('error', reject)
    req.end()
  })
}

/** One deadline and byte ceiling cover all manually followed, DNS-pinned hops. */
export async function publicFetch(
  value: string,
  options: PublicFetchOptions = {},
) {
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024
  const timeoutMs = options.timeoutMs ?? 8000
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0 ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  ) {
    throw new Error('Invalid preview resource limits')
  }
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout>
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('Preview request timed out'))
    }, timeoutMs)
  })
  const operation = async () => {
    let url = parseTarget(value)
    for (let hop = 0; hop <= 3; hop++) {
      const hostname = url.hostname.replace(/^\[|\]$/g, '')
      const addresses = isIP(hostname)
        ? [hostname]
        : await (
            options.resolve ??
            (async host =>
              (await lookup(host, { all: true, verbatim: true })).map(
                item => item.address,
              ))
          )(hostname)
      if (controller.signal.aborted) {
        throw new Error('Preview request timed out')
      }
      if (
        !addresses.length ||
        addresses.some(address => !isPublicAddress(address))
      ) {
        throw new Error(
          'Preview hostname must resolve exclusively to public addresses',
        )
      }
      const response = await (options.send ?? sendPinned)({
        url,
        address: addresses[0]!,
        maxBytes,
        signal: controller.signal,
      })
      if (controller.signal.aborted) {
        throw new Error('Preview request timed out')
      }
      if (response.body.length > maxBytes) {
        throw new Error('Preview response exceeds byte limit')
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (hop === 3 || !response.headers.location) {
          throw new Error('Preview redirect limit exceeded')
        }
        url = parseTarget(new URL(response.headers.location, url).href)
        continue
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Preview HTTP status ${response.status}`)
      }
      return { ...response, url: url.href }
    }
    throw new Error('Preview redirect limit exceeded')
  }
  try {
    return await Promise.race([operation(), deadline])
  } finally {
    clearTimeout(timer!)
  }
}
