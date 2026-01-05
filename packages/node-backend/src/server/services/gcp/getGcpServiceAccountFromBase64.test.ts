// npx vitest run ./src/server/services/gcp/getGcpServiceAccountFromBase64.test.ts
import { describe, expect, it } from 'vitest'
import {
  type GCPServiceAccount,
  getGcpServiceAccountFromBase64,
} from './getGcpServiceAccountFromBase64'

describe('getGcpServiceAccountFromBase64', () => {
  const mockServiceAccount: GCPServiceAccount = {
    keyFilename: 'test-key.json',
    project_id: 'test-project-123',
    client_id: '123456789',
    client_email: 'test@test-project-123.iam.gserviceaccount.com',
    private_key:
      '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
    private_key_id: 'abc123def456',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    type: 'service_account',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url:
      'https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project-123.iam.gserviceaccount.com',
  }

  it('should parse valid base64 encoded service account', () => {
    const base64 = Buffer.from(JSON.stringify(mockServiceAccount)).toString(
      'base64',
    )

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result).toEqual(mockServiceAccount)
    expect(result?.project_id).toBe('test-project-123')
    expect(result?.client_email).toBe(
      'test@test-project-123.iam.gserviceaccount.com',
    )
    expect(result?.type).toBe('service_account')
  })

  it('should handle minimal service account structure', () => {
    const minimalAccount = {
      keyFilename: 'minimal.json',
      project_id: 'minimal-project',
      client_id: '999',
      client_email: 'minimal@minimal-project.iam.gserviceaccount.com',
      private_key: 'minimal-key',
      private_key_id: 'minimal-id',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      type: 'service_account',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url:
        'https://www.googleapis.com/robot/v1/metadata/x509/minimal.iam.gserviceaccount.com',
    }

    const base64 = Buffer.from(JSON.stringify(minimalAccount)).toString(
      'base64',
    )

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result).toEqual(minimalAccount)
  })

  it('should handle service account with additional properties', () => {
    const extendedAccount = {
      ...mockServiceAccount,
      customProperty: 'custom-value',
      anotherProperty: 123,
      nestedProperty: {
        nested: 'value',
      },
    }

    const base64 = Buffer.from(JSON.stringify(extendedAccount)).toString(
      'base64',
    )

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result).toEqual(extendedAccount)
    expect(result?.customProperty).toBe('custom-value')
    expect(result?.anotherProperty).toBe(123)
    expect(result?.nestedProperty).toEqual({ nested: 'value' })
  })

  it('should handle unicode characters in service account', () => {
    const unicodeAccount = {
      ...mockServiceAccount,
      description: 'Service account with émojis 🚀 and ünïcödé characters',
    }

    const base64 = Buffer.from(JSON.stringify(unicodeAccount), 'utf8').toString(
      'base64',
    )

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result?.description).toBe(
      'Service account with émojis 🚀 and ünïcödé characters',
    )
  })

  it('should handle empty object', () => {
    const emptyObject = {}
    const base64 = Buffer.from(JSON.stringify(emptyObject)).toString('base64')

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result).toEqual({})
  })

  it('should throw error for invalid JSON', () => {
    const invalidJson = 'invalid-json-string'
    const base64 = Buffer.from(invalidJson).toString('base64')

    expect(() => {
      getGcpServiceAccountFromBase64(base64)
    }).toThrow()
  })

  it('should throw error for invalid base64', () => {
    const invalidBase64 = 'invalid-base64!'

    expect(() => {
      getGcpServiceAccountFromBase64(invalidBase64)
    }).toThrow()
  })

  it('should handle null and undefined values in service account', () => {
    const accountWithNulls = {
      ...mockServiceAccount,
      optionalField: null,
      undefinedField: undefined,
    }

    const base64 = Buffer.from(JSON.stringify(accountWithNulls)).toString(
      'base64',
    )

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result?.optionalField).toBeNull()
    expect(result?.undefinedField).toBeUndefined()
  })

  it('should handle boolean and number values correctly', () => {
    const accountWithTypes = {
      ...mockServiceAccount,
      isActive: true,
      isTest: false,
      createdAt: 1234567890,
      expiresIn: 3600.5,
    }

    const base64 = Buffer.from(JSON.stringify(accountWithTypes)).toString(
      'base64',
    )

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result?.isActive).toBe(true)
    expect(result?.isTest).toBe(false)
    expect(result?.createdAt).toBe(1234567890)
    expect(result?.expiresIn).toBe(3600.5)
  })

  it('should handle arrays in service account', () => {
    const accountWithArrays = {
      ...mockServiceAccount,
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/bigquery',
      ],
      permissions: [],
    }

    const base64 = Buffer.from(JSON.stringify(accountWithArrays)).toString(
      'base64',
    )

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result?.scopes).toEqual([
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/bigquery',
    ])
    expect(result?.permissions).toEqual([])
  })

  it('should preserve exact string values including whitespace', () => {
    const accountWithWhitespace = {
      ...mockServiceAccount,
      private_key:
        '  -----BEGIN PRIVATE KEY-----\n  test-key-content  \n  -----END PRIVATE KEY-----  ',
      description: '  Service account with leading/trailing spaces  ',
    }

    const base64 = Buffer.from(JSON.stringify(accountWithWhitespace)).toString(
      'base64',
    )

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result?.private_key).toBe(
      '  -----BEGIN PRIVATE KEY-----\n  test-key-content  \n  -----END PRIVATE KEY-----  ',
    )
    expect(result?.description).toBe(
      '  Service account with leading/trailing spaces  ',
    )
  })

  it('should handle very large service account objects', () => {
    const largeAccount = {
      ...mockServiceAccount,
      largeField: 'x'.repeat(10000), // 10KB string
    }

    const base64 = Buffer.from(JSON.stringify(largeAccount)).toString('base64')

    const result = getGcpServiceAccountFromBase64(base64)

    expect(result?.largeField).toBe('x'.repeat(10000))
    expect(result?.project_id).toBe('test-project-123')
  })
})
