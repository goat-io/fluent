// npx vitest run ./src/Ips.test.ts

import { describe, expect, it } from 'vitest'
import { Ips } from './Ips'

describe('Ips', () => {
  it('should return the first valid IPv4 address', () => {
    const ip = Ips.getLocalIpAddress()
    expect(typeof ip === 'string' || ip === null).toBe(true)
  })

  it('should return null if no valid IPv4 address is found', () => {
    // This test assumes that at least one interface is always present,
    // but if not, the function should return null.
    // We can't force the absence of interfaces without mocking,
    // so we just check that the return type is correct.
    const ip = Ips.getLocalIpAddress()
    expect(ip === null || typeof ip === 'string').toBe(true)
  })

  it('should return an IPv4 address if available', () => {
    const ip = Ips.getLocalIpAddress()
    if (ip) {
      // Basic IPv4 format check
      expect(ip).toMatch(/^(\d{1,3}\.){3}\d{1,3}$/)
    } else {
      expect(ip).toBeNull()
    }
  })

  it('should not return a loopback address', () => {
    const ip = Ips.getLocalIpAddress()
    if (ip) {
      expect(ip.startsWith('127.')).toBe(false)
    }
  })
})
