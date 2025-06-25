import { networkInterfaces } from 'os'

class IpsClass {
  getLocalIpAddress = (): string | null => {
    const interfaces = networkInterfaces()
    for (const interfaceName of Object.keys(interfaces)) {
      const addresses = interfaces[interfaceName] || []
      for (const address of addresses) {
        if (
          address.family === 'IPv4' &&
          !address.internal &&
          address.netmask &&
          address.netmask !== '255.255.255.255' // Ensure it has a valid gateway
        ) {
          return address.address
        }
      }
    }
    return null
  }
}

export const Ips = new IpsClass()
