import net from 'net'
import portfinder from 'portfinder'

class PortClass {
  isPortAvailable = async (port: number): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const tester = net
        .createServer()
        .once('error', (err: any) => {
          if (err.code !== 'EADDRINUSE') return reject(err)
          resolve(true)
        })
        .once('listening', () => {
          tester
            .once('close', () => {
              resolve(false)
            })
            .close()
        })
        .listen(port)
    })

  nextAvailablePort = async (port: number) => {
    return portfinder.getPortPromise({
      port
    })
  }
}

export const Ports = new PortClass()
