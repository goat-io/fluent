import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// npm access emits read-only/read-write permissions. Never print its account/package map.
// https://docs.npmjs.com/cli/v10/commands/npm-access
export function verifyPublishAccess({
  token,
  run = runNpm,
  log = console.log,
}) {
  const result = {
    tokenPresent: typeof token === 'string' && token.trim().length > 0,
    authenticationSuccess: false,
    accessLookupSuccess: false,
    exactPackageWrite: false,
  }
  try {
    if (result.tokenPresent) {
      result.authenticationSuccess =
        run(['whoami', '--json', '--registry=https://registry.npmjs.org'])
          .status === 0
      if (result.authenticationSuccess) {
        const access = run([
          'access',
          'list',
          'packages',
          '--json',
          '--registry=https://registry.npmjs.org',
        ])
        if (access.status === 0) {
          const permissions = JSON.parse(access.stdout)
          result.accessLookupSuccess =
            permissions !== null &&
            typeof permissions === 'object' &&
            !Array.isArray(permissions)
          result.exactPackageWrite =
            result.accessLookupSuccess &&
            Object.hasOwn(permissions, '@goatlab/node-metascraper') &&
            permissions['@goatlab/node-metascraper'] === 'read-write'
        }
      }
    }
  } catch {
    // Errors can contain account names, registry payloads, or credentials. Emit fixed booleans only.
  }
  log(`npmPublishAccess ${JSON.stringify(result)}`)
  return result.exactPackageWrite
}

function runNpm(args) {
  return spawnSync('npm', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 20_000,
    maxBuffer: 1024 * 1024,
  })
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!verifyPublishAccess({ token: process.env.NODE_AUTH_TOKEN }))
    process.exitCode = 1
}
