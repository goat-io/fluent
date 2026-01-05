import type {
  MockRequest as ExpressMockRequest,
  RequestOptions,
} from 'node-mocks-http'
import { createRequest } from 'node-mocks-http'
import { mockFirebaseToken } from './firebase.mock'
import { BasicAccount } from './mock.model'

type MockRequest = Record<string, unknown> & ExpressMockRequest<any>

export function mockRequest(options: RequestOptions = {}): MockRequest {
  const request = createRequest(options)
  if (options.ip) {
    Object.assign(request, {
      ip: options.ip,
    })
  }

  Object.assign(request, {
    acceptsLanguages: () => options.acceptsLanguages || [],
  })

  request.log = console.log
  request.warn = console.log
  request.error = console.log

  return request
}

function defaultRequestOptions(): RequestOptions {
  return {
    method: 'GET',
    url: '/',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      // Request from Iphone
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) CriOS/39.0.2171.50 Mobile/12A365 Safari/600.1.4 (000206)',
    },
    acceptsLanguages: ['en', 'es'],
  }
}

export const mockedRegisteredAccountRequest = (
  account?: Partial<BasicAccount>,
  patch: RequestOptions = {},
): MockRequest => {
  const defOptions = defaultRequestOptions()
  const mockedToken = mockFirebaseToken(account)

  return mockRequest({
    ...defOptions,
    headers: {
      authorization: `Bearer ${mockedToken}`,
      ...defOptions.headers,
      // We can extend the headers
    },
    ...patch,
  })
}
