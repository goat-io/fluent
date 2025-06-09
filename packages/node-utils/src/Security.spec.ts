// npx jest -i ./src/Security.spec.ts
import { GeneratedKeyPair, Security } from './Security'

describe('Security', () => {
  const testSecretKey = 'test-secret-key-123'
  const testMessage = 'Hello, World!'
  const testObject = {
    username: 'john_doe',
    email: 'john@example.com',
    token: 'abc123xyz'
  }

  it('Should generate Eliptic Curve Keys', async () => {
    const curve = await Security.generateElipticCurve()

    expect(typeof curve.privateKey).toBe('string')
    expect(typeof curve.publicKey).toBe('string')
  })

  it('Keys should be able to sign and decode', async () => {
    const curve = await Security.generateElipticCurve()

    const message = 'THIS IS A SECRET MESSAGE'

    const encrypted = Security.encryptStringWithElliptic(
      message,
      curve.privateKey
    )

    const verified = Security.verifySignedStringWithElliptic(
      message,
      encrypted,
      curve.publicKey
    )

    const falseVerify = Security.verifySignedStringWithElliptic(
      'THIS IS A SECRET MESSAGE2',
      encrypted,
      curve.publicKey
    )

    expect(typeof encrypted).toBe('string')
    expect(verified).toBe(true)
    expect(falseVerify).toBe(false)
  })

  it('Should generate a password', async () => {
    const password = Security.generatePassword(40)

    expect(typeof password).toBe('string')
    expect(password.length).toBe(40)
  })

  describe('getCryptoParams', () => {
    it('should generate consistent key and iv from same secret', () => {
      const params1 = Security.getCryptoParams(testSecretKey)
      const params2 = Security.getCryptoParams(testSecretKey)

      expect(params1.key).toBe(params2.key)
      expect(params1.iv).toBe(params2.iv)
      expect(params1.key).toHaveLength(32) // MD5 hash length
      expect(params1.iv).toHaveLength(16) // AES block size
    })

    it('should generate different params for different secrets', () => {
      const params1 = Security.getCryptoParams('secret1')
      const params2 = Security.getCryptoParams('secret2')

      expect(params1.key).not.toBe(params2.key)
      expect(params1.iv).not.toBe(params2.iv)
    })
  })

  describe('encryptString and decryptString', () => {
    it('should encrypt and decrypt string correctly', () => {
      const encrypted = Security.encryptString(testMessage, testSecretKey)
      const decrypted = Security.decryptString(encrypted, testSecretKey)

      expect(encrypted).not.toBe(testMessage)
      expect(decrypted).toBe(testMessage)
    })

    it('should produce consistent encryption for same inputs', () => {
      const encrypted1 = Security.encryptString(testMessage, testSecretKey)
      const encrypted2 = Security.encryptString(testMessage, testSecretKey)

      expect(encrypted1).toBe(encrypted2)
    })

    it('should handle empty strings', () => {
      const encrypted = Security.encryptString('', testSecretKey)
      const decrypted = Security.decryptString(encrypted, testSecretKey)

      expect(decrypted).toBe('')
    })

    it('should handle unicode characters', () => {
      const unicodeMessage = '🔐 Hello 世界 🌍'
      const encrypted = Security.encryptString(unicodeMessage, testSecretKey)
      const decrypted = Security.decryptString(encrypted, testSecretKey)

      expect(decrypted).toBe(unicodeMessage)
    })

    it('should throw error with wrong secret key', () => {
      const encrypted = Security.encryptString(testMessage, testSecretKey)

      expect(() => {
        Security.decryptString(encrypted, 'wrong-key')
      }).toThrow()
    })
  })

  describe('encryptObject and decryptObject', () => {
    it('should encrypt and decrypt object correctly', () => {
      const encrypted = Security.encryptObject(testObject, testSecretKey)
      const decrypted = Security.decryptObject(encrypted, testSecretKey)

      expect(encrypted).not.toEqual(testObject)
      expect(decrypted).toEqual(testObject)
    })

    it('should encrypt all values but keep keys unchanged', () => {
      const encrypted = Security.encryptObject(testObject, testSecretKey)

      expect(Object.keys(encrypted)).toEqual(Object.keys(testObject))
      expect(encrypted['username']).not.toBe(testObject.username)
      expect(encrypted['email']).not.toBe(testObject.email)
      expect(encrypted['token']).not.toBe(testObject.token)
    })

    it('should handle empty object', () => {
      const emptyObj = {}
      const encrypted = Security.encryptObject(emptyObj, testSecretKey)
      const decrypted = Security.decryptObject(encrypted, testSecretKey)

      expect(encrypted).toEqual({})
      expect(decrypted).toEqual({})
    })

    it('should handle object with empty string values', () => {
      const objWithEmpty = { key1: '', key2: 'value' }
      const encrypted = Security.encryptObject(objWithEmpty, testSecretKey)
      const decrypted = Security.decryptObject(encrypted, testSecretKey)

      expect(decrypted).toEqual(objWithEmpty)
    })
  })

  describe('encryptRandomIVBuffer and decryptRandomIVBuffer', () => {
    const testBuffer = Buffer.from('Test buffer content')
    const secretKeyBase64 = Buffer.from('my-secret-key').toString('base64')

    it('should encrypt and decrypt buffer correctly', () => {
      const encrypted = Security.encryptRandomIVBuffer(
        testBuffer,
        secretKeyBase64
      )
      const decrypted = Security.decryptRandomIVBuffer(
        encrypted,
        secretKeyBase64
      )

      expect(encrypted).not.toEqual(testBuffer)
      expect(decrypted).toEqual(testBuffer)
    })

    it('should produce different encrypted results each time (non-deterministic)', () => {
      const encrypted1 = Security.encryptRandomIVBuffer(
        testBuffer,
        secretKeyBase64
      )
      const encrypted2 = Security.encryptRandomIVBuffer(
        testBuffer,
        secretKeyBase64
      )

      expect(encrypted1).not.toEqual(encrypted2)
    })

    it('should include IV in encrypted buffer (first 16 bytes)', () => {
      const encrypted = Security.encryptRandomIVBuffer(
        testBuffer,
        secretKeyBase64
      )

      expect(encrypted.length).toBeGreaterThan(16) // IV + encrypted data

      // Extract IV and verify it's different each time
      const iv1 = encrypted.slice(0, 16)
      const encrypted2 = Security.encryptRandomIVBuffer(
        testBuffer,
        secretKeyBase64
      )
      const iv2 = encrypted2.slice(0, 16)

      expect(iv1).not.toEqual(iv2)
    })

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0)
      const encrypted = Security.encryptRandomIVBuffer(
        emptyBuffer,
        secretKeyBase64
      )
      const decrypted = Security.decryptRandomIVBuffer(
        encrypted,
        secretKeyBase64
      )

      expect(decrypted).toEqual(emptyBuffer)
    })

    it('should throw error with wrong secret key', () => {
      const encrypted = Security.encryptRandomIVBuffer(
        testBuffer,
        secretKeyBase64
      )
      const wrongKey = Buffer.from('wrong-key').toString('base64')

      expect(() => {
        Security.decryptRandomIVBuffer(encrypted, wrongKey)
      }).toThrow()
    })
  })

  describe('generateElipticCurve', () => {
    it('should generate valid Ed25519 key pair', async () => {
      const keyPair = await Security.generateElipticCurve()

      expect(keyPair).toHaveProperty('publicKey')
      expect(keyPair).toHaveProperty('privateKey')
      expect(typeof keyPair.publicKey).toBe('string')
      expect(typeof keyPair.privateKey).toBe('string')

      // Check PEM format
      expect(keyPair.publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/)
      expect(keyPair.publicKey).toMatch(/-----END PUBLIC KEY-----\s*$/)
      expect(keyPair.privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/)
      expect(keyPair.privateKey).toMatch(/-----END PRIVATE KEY-----\s*$/)
    })

    it('should generate different key pairs each time', async () => {
      const keyPair1 = await Security.generateElipticCurve()
      const keyPair2 = await Security.generateElipticCurve()

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey)
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey)
    })
  })

  describe('encryptStringWithElliptic and verifySignedStringWithElliptic', () => {
    let keyPair: GeneratedKeyPair

    beforeAll(async () => {
      keyPair = await Security.generateElipticCurve()
    })

    it('should sign and verify message correctly', () => {
      const signature = Security.encryptStringWithElliptic(
        testMessage,
        keyPair.privateKey
      )
      const isValid = Security.verifySignedStringWithElliptic(
        testMessage,
        signature,
        keyPair.publicKey
      )

      expect(typeof signature).toBe('string')
      expect(signature.length).toBeGreaterThan(0)
      expect(isValid).toBe(true)
    })

    it('should return false for tampered signature', () => {
      // Create a valid base64 string but with different content
      const tamperedSignature = Buffer.from('tampered signature data').toString(
        'base64'
      )
      const isValid = Security.verifySignedStringWithElliptic(
        testMessage,
        tamperedSignature,
        keyPair.publicKey
      )

      expect(isValid).toBe(false)
    })

    it('should return false with wrong public key', async () => {
      const wrongKeyPair = await Security.generateElipticCurve()
      const signature = Security.encryptStringWithElliptic(
        testMessage,
        keyPair.privateKey
      )
      const isValid = Security.verifySignedStringWithElliptic(
        testMessage,
        signature,
        wrongKeyPair.publicKey
      )

      expect(isValid).toBe(false)
    })

    it('should handle empty message', () => {
      const signature = Security.encryptStringWithElliptic(
        '',
        keyPair.privateKey
      )
      const isValid = Security.verifySignedStringWithElliptic(
        '',
        signature,
        keyPair.publicKey
      )

      expect(isValid).toBe(true)
    })

    it('should handle unicode messages', () => {
      const unicodeMessage = '🔐 Test 世界 🌍'
      const signature = Security.encryptStringWithElliptic(
        unicodeMessage,
        keyPair.privateKey
      )
      const isValid = Security.verifySignedStringWithElliptic(
        unicodeMessage,
        signature,
        keyPair.publicKey
      )

      expect(isValid).toBe(true)
    })
  })

  describe('generatePassword', () => {
    it('should generate password of correct length', () => {
      const lengths = [8, 12, 16, 32, 64]

      lengths.forEach(length => {
        const password = Security.generatePassword(length)
        expect(password).toHaveLength(length)
      })
    })

    it('should generate different passwords each time', () => {
      const password1 = Security.generatePassword(16)
      const password2 = Security.generatePassword(16)

      expect(password1).not.toBe(password2)
    })

    it('should contain only valid characters', () => {
      const password = Security.generatePassword(100)
      const validChars = /^[a-zA-Z0-9!#$%&()+,\-.<=>?@^_]+$/

      expect(password).toMatch(validChars)
    })

    it('should handle edge cases', () => {
      const emptyPassword = Security.generatePassword(0)
      expect(emptyPassword).toBe('')

      const singleChar = Security.generatePassword(1)
      expect(singleChar).toHaveLength(1)
    })

    it('should use all character sets over many generations', () => {
      // Generate many passwords and check if all character types appear
      let allChars = ''
      for (let i = 0; i < 100; i++) {
        allChars += Security.generatePassword(20)
      }

      expect(allChars).toMatch(/[a-z]/) // lowercase
      expect(allChars).toMatch(/[A-Z]/) // uppercase
      expect(allChars).toMatch(/[0-9]/) // numbers
      expect(allChars).toMatch(/[!#$%&()+,\-.<=>?@^_]/) // symbols
    })

    it('should be cryptographically random', () => {
      // Test for basic randomness by checking distribution
      const passwords = Array.from({ length: 1000 }, () =>
        Security.generatePassword(1)
      )
      const uniqueChars = new Set(passwords)

      // Should have good variety of characters (at least 20 different ones)
      expect(uniqueChars.size).toBeGreaterThan(20)
    })
  })

  describe('Error handling', () => {
    it('should handle malformed encrypted data', () => {
      expect(() => {
        Security.decryptString('invalid-encrypted-data', testSecretKey)
      }).toThrow()
    })

    it('should handle invalid PEM keys in elliptic methods', () => {
      expect(() => {
        Security.encryptStringWithElliptic(testMessage, 'invalid-private-key')
      }).toThrow()

      expect(() => {
        Security.verifySignedStringWithElliptic(
          testMessage,
          'dGVzdA==', // valid base64 but invalid signature
          'invalid-public-key'
        )
      }).toThrow()
    })
  })
})
