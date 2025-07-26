// npx vitest run ./src/server/services/util/url.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { UrlService } from './url.service'
import type { Environment } from '../../types/Envinronment'

describe('UrlService', () => {
  let urlService: UrlService

  const defaultConfig = {
    publicBucketName: 'public-bucket',
    privateBucketName: 'private-bucket',
    baseDomain: 'example.com',
    backendApiBaseUrl: 'http://localhost:8086',
    environment: 'local' as Environment
  }

  beforeEach(() => {
    urlService = new UrlService(defaultConfig)
  })

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(urlService.publicBucketName).toBe('public-bucket')
      expect(urlService.privateBucketName).toBe('private-bucket')
      expect(urlService.baseDomain).toBe('example.com')
      expect(urlService.backendApiBaseUrl).toBe('http://localhost:8086')
      expect(urlService.environment).toBe('local')
    })
  })

  describe('getBackendUrl', () => {
    it('should return backend API base URL for local environment', () => {
      const result = urlService.getBackendUrl()
      expect(result).toBe('http://localhost:8086')
    })

    it('should return backend API base URL for local environment with options', () => {
      const result = urlService.getBackendUrl({ isMobile: true, useIP: true })
      expect(result).toBe('http://localhost:8086')
    })

    it('should return mobile URL for non-local environment with mobile flag', () => {
      urlService.environment = 'dev'
      const result = urlService.getBackendUrl({ isMobile: true })
      expect(result).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:8086$/)
    })

    it('should return mobile URL for non-local environment with useIP flag', () => {
      urlService.environment = 'prod'
      const result = urlService.getBackendUrl({ useIP: true })
      expect(result).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:8086$/)
    })

    it('should return hardcoded API URL for non-local environment without flags', () => {
      urlService.environment = 'prod'
      const result = urlService.getBackendUrl()
      expect(result).toBe('https://api.a.getsodium.com')
    })
  })

  describe('getLocalStorageHostUrl', () => {
    it('should return HTTPS URL for local environment without mobile/IP flags', async () => {
      const result = await urlService.getLocalStorageHostUrl({})
      expect(result).toBe('https://assets.a.getsodium.com')
    })

    it('should return HTTP URL with IP for mobile flag', async () => {
      const result = await urlService.getLocalStorageHostUrl({ isMobile: true })
      expect(result).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:9199$/)
    })

    it('should return HTTP URL with IP for useIP flag', async () => {
      const result = await urlService.getLocalStorageHostUrl({ useIP: true })
      expect(result).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:9199$/)
    })
  })

  describe('getPublicStorageUrl', () => {
    it('should return local storage URL for local environment', async () => {
      const result = await urlService.getPublicStorageUrl({})
      expect(result).toBe('https://assets.a.getsodium.com/public-bucket')
    })

    it('should return local storage URL with IP for mobile flag in local', async () => {
      const result = await urlService.getPublicStorageUrl({ isMobile: true })
      expect(result).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:9199\/public-bucket$/)
    })

    it('should return production URL for prod environment', async () => {
      urlService.environment = 'prod'
      const result = await urlService.getPublicStorageUrl({})
      expect(result).toBe('https://assets.example.com')
    })

    it('should return dev URL for dev environment', async () => {
      urlService.environment = 'dev'
      const result = await urlService.getPublicStorageUrl({})
      expect(result).toBe('https://assets-dev.example.com')
    })
  })

  describe('getPrivateStorageUrl', () => {
    it('should return local storage URL for local environment', async () => {
      const result = await urlService.getPrivateStorageUrl({})
      expect(result).toBe('https://assets.a.getsodium.com/private-bucket')
    })

    it('should return local storage URL with IP for mobile flag in local', async () => {
      const result = await urlService.getPrivateStorageUrl({ isMobile: true })
      expect(result).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:9199\/private-bucket$/)
    })

    it('should return production URL for prod environment', async () => {
      urlService.environment = 'prod'
      const result = await urlService.getPrivateStorageUrl({})
      expect(result).toBe('https://private-assets.example.com')
    })

    it('should return dev URL for dev environment', async () => {
      urlService.environment = 'dev'
      const result = await urlService.getPrivateStorageUrl({})
      expect(result).toBe('https://private-assets-dev.example.com')
    })
  })

  describe('getFrontendUrl', () => {
    it('should return hardcoded URL for local environment', () => {
      const result = urlService.getFrontendUrl()
      expect(result).toBe('https://frontend.a.getsodium.com')
    })

    it('should return dev URL for prod environment', () => {
      urlService.environment = 'prod'
      const result = urlService.getFrontendUrl()
      expect(result).toBe('https://dev.example.com')
    })

    it('should return base domain for dev environment', () => {
      urlService.environment = 'dev'
      const result = urlService.getFrontendUrl()
      expect(result).toBe('https://example.com')
    })
  })

  describe('getFrontendRedirectURL', () => {
    it('should return provided origin when given', () => {
      const origin = 'https://custom.origin.com'
      const result = urlService.getFrontendRedirectURL(origin)
      expect(result).toBe(origin)
    })

    it('should return base domain for prod environment without origin', () => {
      urlService.environment = 'prod'
      const result = urlService.getFrontendRedirectURL()
      expect(result).toBe('https://example.com')
    })

    it('should return localhost for local environment without origin', () => {
      const result = urlService.getFrontendRedirectURL()
      expect(result).toBe('https://localhost:4430')
    })

    it('should return dev domain for dev environment with K_SERVICE', () => {
      urlService.environment = 'dev'
      process.env.K_SERVICE = 'true'
      const result = urlService.getFrontendRedirectURL()
      expect(result).toBe('https://dev.example.com')
      delete process.env.K_SERVICE
    })
  })

  describe('getBackendRedirectURLForTransBankPayments', () => {
    it('should construct correct URL with all parameters', () => {
      const params = {
        origin: 'https://test.com',
        orderId: 'order123',
        storeId: 'store456'
      }
      
      const result = urlService.getBackendRedirectURLForTransBankPayments(params)
      expect(result).toBe('http://localhost:8086/payments/process?origin=https://test.com&storeId=store456&orderId=order123')
    })

    it('should handle undefined parameters', () => {
      const result = urlService.getBackendRedirectURLForTransBankPayments({})
      expect(result).toBe('http://localhost:8086/payments/process?origin=undefined&storeId=undefined&orderId=undefined')
    })
  })

  describe('getPaymentSuccessRedirectURL', () => {
    it('should construct correct success URL with origin', () => {
      const origin = 'https://test.com'
      const orderId = 'order123'
      const result = urlService.getPaymentSuccessRedirectURL(origin, orderId)
      expect(result).toBe('https://test.com/payment/processed?orderId=order123')
    })

    it('should construct correct success URL without origin', () => {
      const orderId = 'order123'
      const result = urlService.getPaymentSuccessRedirectURL(undefined, orderId)
      expect(result).toBe('https://localhost:4430/payment/processed?orderId=order123')
    })

    it('should URL encode order ID', () => {
      const orderId = 'order with spaces & special chars'
      const result = urlService.getPaymentSuccessRedirectURL('https://test.com', orderId)
      expect(result).toBe('https://test.com/payment/processed?orderId=order%20with%20spaces%20%26%20special%20chars')
    })
  })

  describe('getPaymentFailedRedirectURL', () => {
    it('should construct correct failed URL with origin', () => {
      const origin = 'https://test.com'
      const orderId = 'order123'
      const result = urlService.getPaymentFailedRedirectURL(origin, orderId)
      expect(result).toBe('https://test.com/payment/cancelled?paymentFailed=true&orderId=order123')
    })

    it('should construct correct failed URL without origin', () => {
      const orderId = 'order123'
      const result = urlService.getPaymentFailedRedirectURL(undefined, orderId)
      expect(result).toBe('https://localhost:4430/payment/cancelled?paymentFailed=true&orderId=order123')
    })

    it('should URL encode order ID', () => {
      const orderId = 'order with spaces & special chars'
      const result = urlService.getPaymentFailedRedirectURL('https://test.com', orderId)
      expect(result).toBe('https://test.com/payment/cancelled?paymentFailed=true&orderId=order%20with%20spaces%20%26%20special%20chars')
    })
  })

  describe('getPaymentCancelledRedirectURL', () => {
    it('should construct correct cancelled URL with origin', () => {
      const origin = 'https://test.com'
      const orderId = 'order123'
      const result = urlService.getPaymentCancelledRedirectURL(origin, orderId)
      expect(result).toBe('https://test.com/payment/cancelled?orderId=order123')
    })

    it('should construct correct cancelled URL without origin', () => {
      const orderId = 'order123'
      const result = urlService.getPaymentCancelledRedirectURL(undefined, orderId)
      expect(result).toBe('https://localhost:4430/payment/cancelled?orderId=order123')
    })

    it('should URL encode order ID', () => {
      const orderId = 'order with spaces & special chars'
      const result = urlService.getPaymentCancelledRedirectURL('https://test.com', orderId)
      expect(result).toBe('https://test.com/payment/cancelled?orderId=order%20with%20spaces%20%26%20special%20chars')
    })
  })

  describe('different environments', () => {
    it('should handle staging environment', () => {
      const stagingService = new UrlService({
        ...defaultConfig,
        environment: 'staging' as Environment
      })

      expect(stagingService.getFrontendUrl()).toBe('https://example.com')
    })

    it('should handle test environment', () => {
      const testService = new UrlService({
        ...defaultConfig,
        environment: 'test' as Environment
      })

      expect(testService.getFrontendUrl()).toBe('https://example.com')
    })
  })
})