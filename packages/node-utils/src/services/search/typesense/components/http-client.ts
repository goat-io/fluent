// TypesenseHttpClient - Handles network wrapper concerns
import { Http } from '@goatlab/js-utils'
import type { KyInstance } from '@goatlab/js-utils'
import { TypesenseError } from '../typesense.model'

export interface HttpClientOptions {
  prefixUrl: string
  token: string
  searchTimeout?: number
  importTimeout?: number
  defaultTimeout?: number
  beforeRequest?: Array<(request: Request) => void | Promise<void>>
  afterResponse?: any[]
  kyInstance?: KyInstance
  enforceTLS?: boolean
}

export class TypesenseHttpClient {
  private kyInstance: KyInstance
  private readonly enforceTLS: boolean
  private readonly options: HttpClientOptions

  constructor(options: HttpClientOptions) {
    this.enforceTLS = options.enforceTLS ?? process.env.NODE_ENV === 'production'
    this.options = options
    
    // Security: Enforce HTTPS in production
    if (this.enforceTLS && !options.prefixUrl.startsWith('https://')) {
      throw new Error('HTTPS is required in production environment')
    }

    this.kyInstance = options.kyInstance || this.createDefaultClient(options)
  }

  private createDefaultClient(options: HttpClientOptions): KyInstance {
    return Http.getClient({
      prefixUrl: options.prefixUrl,
      timeout: options.defaultTimeout || 10000,
      headers: {
        'X-TYPESENSE-API-KEY': options.token,
        'Content-Type': 'application/json'
      },
      hooks: {
        beforeRequest: options.beforeRequest || [],
        afterResponse: options.afterResponse || [],
        beforeError: [
          async (error) => {
            const { response } = error
            if (response) {
              try {
                const errorBody = await response.json()
                // Security: Redact token from headers before throwing
                const sanitizedHeaders = this.sanitizeHeaders(error.request.headers)
                throw new TypesenseError(
                  (errorBody as any).message || error.message,
                  response.status,
                  errorBody,
                  sanitizedHeaders
                )
              } catch (parseError) {
                // If we can't parse the response, fall back to basic error
                throw new TypesenseError(
                  error.message,
                  response.status,
                  null,
                  this.sanitizeHeaders(error.request.headers)
                )
              }
            }
            throw error
          }
        ]
      }
    })
  }

  private sanitizeHeaders(headers: Headers): Record<string, string> {
    const sanitized: Record<string, string> = {}
    headers.forEach((value, key) => {
      // Security: Redact sensitive headers
      if (key.toLowerCase().includes('api-key') || key.toLowerCase().includes('authorization')) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = value
      }
    })
    return sanitized
  }

  async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: any
      searchParams?: Record<string, any>
      timeout?: number
      signal?: AbortSignal
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, searchParams, timeout, signal } = options

    // Remove leading slash for prefixUrl compatibility
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint

    const requestOptions: any = {
      method,
      timeout: timeout || 10000,
      signal
    }

    if (body) {
      requestOptions.json = body
    }

    if (searchParams) {
      requestOptions.searchParams = searchParams
    }

    const response = await this.kyInstance(cleanEndpoint, requestOptions)
    return response.json()
  }

  async requestText(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: any
      searchParams?: Record<string, any>
      timeout?: number
      signal?: AbortSignal
    } = {}
  ): Promise<string> {
    const { method = 'GET', body, searchParams, timeout, signal } = options

    // Remove leading slash for prefixUrl compatibility
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint

    const requestOptions: any = {
      method,
      timeout: timeout || 10000,
      signal
    }

    if (body) {
      requestOptions.json = body
    }

    if (searchParams) {
      requestOptions.searchParams = searchParams
    }

    const response = await this.kyInstance(cleanEndpoint, requestOptions)
    return response.text()
  }

  async requestTextWithRawBody(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: any
      searchParams?: Record<string, any>
      timeout?: number
      signal?: AbortSignal
    } = {}
  ): Promise<string> {
    const { method = 'GET', body, searchParams, timeout, signal } = options

    // Remove leading slash for prefixUrl compatibility
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint

    const requestOptions: any = {
      method,
      timeout: timeout || 10000,
      signal
    }

    if (body) {
      // Use raw body instead of JSON encoding
      requestOptions.body = body
    }

    if (searchParams) {
      requestOptions.searchParams = searchParams
    }

    const response = await this.kyInstance(cleanEndpoint, requestOptions)
    return response.text()
  }

  async stream(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST'
      body?: any
      searchParams?: Record<string, any>
      signal?: AbortSignal
    } = {}
  ): Promise<ReadableStream> {
    const { method = 'GET', body, searchParams, signal } = options

    // Remove leading slash for prefixUrl compatibility
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint

    const requestOptions: any = {
      method,
      signal
    }

    if (body) {
      requestOptions.body = body
    }

    if (searchParams) {
      requestOptions.searchParams = searchParams
    }

    const response = await this.kyInstance(cleanEndpoint, requestOptions)
    
    if (!response.body) {
      throw new Error('Response body is not available for streaming')
    }

    return response.body
  }

  getClient(): KyInstance {
    return this.kyInstance
  }

  getOptions(): HttpClientOptions {
    return this.options
  }
}