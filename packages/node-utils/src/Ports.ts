import net from 'net'
import * as portfinder from 'portfinder'

class PortClass {
  private portAllocationLock = new Set<number>()
  private lastAllocatedPort = 8000

  isPortAvailable = async (port: number): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const tester = net
        .createServer()
        .once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            resolve(false)
          } else {
            reject(err)
          }
        })
        .once('listening', () => {
          tester.close(() => resolve(true))
        })
        .listen(port)
    })

  nextAvailablePort = async (port: number = 8000) => {
    // Use a higher starting port for each concurrent request to avoid conflicts
    const startPort = Math.max(port, this.lastAllocatedPort + 1)

    let attempts = 0
    const maxAttempts = 100

    while (attempts < maxAttempts) {
      try {
        const candidatePort = await portfinder.getPortPromise({
          port: startPort + attempts,
        })

        // Check if this port is already being allocated by another call
        if (!this.portAllocationLock.has(candidatePort)) {
          // Reserve this port temporarily
          this.portAllocationLock.add(candidatePort)
          this.lastAllocatedPort = candidatePort

          // Release the lock after a short delay to allow the server to start
          setTimeout(() => {
            this.portAllocationLock.delete(candidatePort)
          }, 1000)

          return candidatePort
        }

        attempts++
      } catch (error) {
        attempts++
        if (attempts >= maxAttempts) {
          throw error
        }
      }
    }

    throw new Error(
      `Could not find an available port after ${maxAttempts} attempts`,
    )
  }

  getAvailablePort = async () => {
    return this.nextAvailablePort()
  }
}

export const Ports = new PortClass()
