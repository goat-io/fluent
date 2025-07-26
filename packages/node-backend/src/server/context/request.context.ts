import type { Request } from 'express'
import UAParser from 'ua-parser-js'
import type { DecodedUserToken } from '../schemas/user.schema'
import type { LocationOutput } from './context.model'

export const requestContext = (request: Request, token?: DecodedUserToken) => {
  const userAgent = request.headers['user-agent'] || ''
  const parser = new UAParser(userAgent)
  const result = parser.getResult()

  const ip =
    request.ip ??
    request.socket.remoteAddress ??
    (request.headers['x-forwarded-for'] as string) ??
    ''

  const xTenandId = (request.headers['x-tenant-id'] as string) || ''

  return {
    user:
      token && 'email' in token
        ? {
            decodedToken: token,
            email: 'email' in token ? token.email : undefined,
            firebaseId: 'uid' in token ? token.uid : undefined,
          }
        : undefined,
    url: request.url,
    method: request.method,
    xTenandId,
    origin: request.get('origin'),
    ip,
    async getLocation(): Promise<LocationOutput> {
      // We do not want to import these at the top of the file
      // because they are not used in all requests
      // and we can use the user's location instead

      const geoIp = await import('geoip-lite')

      const publicIP = await import('public-ip')

      const tryGetIp = async () => {
        try {
          return await publicIP.publicIpv4()
        } catch {
          return null
        }
      }

      const isLocalhost = ['127.0.0.1', 'localhost', '192.168.0.1']

      const publicIp = isLocalhost.includes(ip) ? await tryGetIp() : ip

      const location = geoIp.lookup(publicIp || '') as any as Omit<
        LocationOutput,
        'publicIp' | 'ip'
      >

      return {
        ip,
        publicIp: publicIp || '',
        ...location,
      }
    },
    endpoint: [request.method, request.path || request.url]
      .map((s) => s.toLowerCase())
      .join(' '),
    device: {
      isMobile: result?.device?.type === 'mobile',
      isWebApp: result?.device?.type !== 'mobile',
      //isMobileApp: result.ua.includes(env.APP_NAME),
      isMacPC:
        result.os.name === 'Mac OS' || result?.device?.model === 'Macintosh',
      os: result.os.name,
      isIOS: result.os.name === 'iOS',
      isAndroid: result.os.name === 'Android',
    },
  }
}
