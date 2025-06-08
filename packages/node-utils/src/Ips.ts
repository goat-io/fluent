import os from 'os'

class IpsClass {
  getLocalIpAddress = (): string | null => {
    const networkInterfaces = os.networkInterfaces()
    for (const interfaceName of Object.keys(networkInterfaces)) {
      const addresses = networkInterfaces[interfaceName] || []
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
