import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import {
  GenericContainer,
  getContainerRuntimeClient,
  Network,
  type StartedNetwork,
  type StartedTestContainer,
  Wait,
} from 'testcontainers'
import { cleanGlobalData, writeGlobalData } from './const.js'
import type { HatchetStartupDiagnostics } from './hatchet.types.js'
import { getPostgres } from './postgres.js'

export const getHatchetContainer = ({
  postgresConnectionString,
  network,
}: {
  postgresConnectionString: string
  network: StartedNetwork
}) => {
  return new DiagnosticHatchetContainer(
    'ghcr.io/hatchet-dev/hatchet/hatchet-lite:latest',
  )
    .withEnvironment({
      DATABASE_URL: postgresConnectionString,
      SERVER_AUTH_COOKIE_DOMAIN: 'localhost',
      SERVER_AUTH_COOKIE_INSECURE: 't',
      SERVER_GRPC_BIND_ADDRESS: '0.0.0.0',
      SERVER_GRPC_INSECURE: 't',
      SERVER_GRPC_BROADCAST_ADDRESS: 'localhost:7077',
      SERVER_GRPC_PORT: '7077',
      SERVER_URL: 'http://localhost:8888',
      SERVER_AUTH_SET_EMAIL_VERIFIED: 't',
      SERVER_DEFAULT_ENGINE_VERSION: 'V1',
      SERVER_INTERNAL_CLIENT_INTERNAL_GRPC_BROADCAST_ADDRESS: 'localhost:7077',
    })
    .withNetwork(network)
    .withExposedPorts(8888, 7077)
    .withWaitStrategy(
      Wait.forLogMessage(
        `created tenant 707d0855-80ab-4e1f-a156-f1c4546cbf52`,
        1,
      ).withStartupTimeout(60_000),
    )
}

const EXPECTED_TENANT_ID = '707d0855-80ab-4e1f-a156-f1c4546cbf52'

/** Proposed semantic log matcher, reported diagnostically before changing readiness. */
export function matchesExpectedTenantCreation(value: string) {
  return new RegExp(`created tenant[^\\r\\n]*${EXPECTED_TENANT_ID}`, 'i').test(
    value,
  )
}

/** Retain bounded logs in memory; output only fixed classifications and key names. */
export function createStartupDiagnostics() {
  let recent = ''
  return {
    append(value: string | Buffer) {
      recent = (recent + value.toString().slice(-32768)).slice(-32768)
    },
    summary(): HatchetStartupDiagnostics {
      const patterns: [string, RegExp][] = [
        [
          'database_authentication_failed',
          /password authentication failed|SASL authentication failed/i,
        ],
        ['connection_refused', /connection refused/i],
        ['connection_timeout', /i\/o timeout|connection.*timed out/i],
        ['database_migration_failed', /(?:migrat|schema)[^\n]*(?:fail|error)/i],
        [
          'database_schema_incompatible',
          /(?:column|relation)[^\n]*does not exist/i,
        ],
        ['port_bind_failed', /address already in use|bind[^\n]*failed/i],
        ['permission_denied', /permission denied/i],
        [
          'missing_configuration',
          /(?:missing|required|must be set)[^\n]*(?:config|environment|variable)|(?:config|environment|variable)[^\n]*(?:missing|required|not set)/i,
        ],
        [
          'invalid_configuration',
          /(?:invalid|unknown|unrecognized)[^\n]*(?:flag|config|option|engine version)/i,
        ],
        ['tls_failure', /x509|certificate|tls handshake/i],
        [
          'missing_file_or_executable',
          /no such file|executable file not found/i,
        ],
        ['process_panic', /\bpanic\b/i],
        ['process_fatal', /\bfatal\b/i],
        ['process_error', /\berror\b/i],
        ['engine_serving', /listening|server started|grpc[^\n]*started/i],
        ['tenant_created', /created tenant/i],
      ]
      const forward = recent.match(
        new RegExp(`created tenant([^\\r\\n]*?)${EXPECTED_TENANT_ID}`, 'i'),
      )
      const reverse = recent.match(
        new RegExp(`${EXPECTED_TENANT_ID}([^\\r\\n]*?)created tenant`, 'i'),
      )
      const separator = (forward?.[1] ?? reverse?.[1])
        ?.replace(/[^\s,:;="'{}()[\]]+/g, '[redacted]')
        .replace(/\s+/g, ' ')
        .slice(0, 192)
      return {
        proposedReadinessMatch: matchesExpectedTenantCreation(recent),
        caseInsensitiveExactMatch: recent
          .toLowerCase()
          .includes(`created tenant ${EXPECTED_TENANT_ID}`),
        tenantIdBeforeMarkerSameLine: !!reverse,
        safeTenantCreationForm: forward
          ? `created tenant${separator}${EXPECTED_TENANT_ID}`
          : reverse
            ? `${EXPECTED_TENANT_ID}${separator}created tenant`
            : undefined,
        classifications: patterns
          .filter(([, pattern]) => pattern.test(recent))
          .map(([label]) => label),
        mentionedConfigurationKeys: [
          'DATABASE_URL',
          'SERVER_DEFAULT_ENGINE_VERSION',
          'SERVER_GRPC_BIND_ADDRESS',
          'SERVER_GRPC_PORT',
          'SERVER_GRPC_BROADCAST_ADDRESS',
          'SERVER_INTERNAL_CLIENT_INTERNAL_GRPC_BROADCAST_ADDRESS',
          'SERVER_AUTH_COOKIE_DOMAIN',
          'SERVER_AUTH_COOKIE_INSECURE',
          'SERVER_AUTH_SET_EMAIL_VERIFIED',
          'SERVER_URL',
        ].filter(key => recent.includes(key)),
        expectedTenantIdSeen: recent.includes(
          '707d0855-80ab-4e1f-a156-f1c4546cbf52',
        ),
        expectedTenantLogSeen: recent.includes(
          'created tenant 707d0855-80ab-4e1f-a156-f1c4546cbf52',
        ),
        recentLogChars: recent.length,
      }
    },
  }
}

class DiagnosticHatchetContainer extends GenericContainer {
  private fixtureContainerId?: string
  protected async containerCreated(id: string) {
    this.fixtureContainerId = id
  }

  async start(): Promise<StartedTestContainer> {
    const logs = createStartupDiagnostics()
    this.withLogConsumer(stream => {
      stream.on('data', chunk => logs.append(chunk))
      stream.on('err', chunk => logs.append(chunk))
    })
    try {
      return await super.start()
    } catch {
      // Snapshot diagnostics before removing resources. Never serialize Config.Env,
      // raw engine output, generated tokens, or the database connection string.
      const diagnostics: object = logs.summary()
      let state: object = { inspectionAvailable: false }
      if (this.fixtureContainerId) {
        try {
          const client = await getContainerRuntimeClient()
          const container = client.container.getById(this.fixtureContainerId)
          try {
            const inspected = await client.container.inspect(container)
            state = {
              running: inspected.State.Running,
              exitCode: inspected.State.ExitCode,
              oomKilled: inspected.State.OOMKilled,
              imageId: /^sha256:[a-f0-9]{64}$/.test(inspected.Image)
                ? inspected.Image
                : undefined,
            }
          } catch {
            /* The runtime may already have removed a failed container. */
          }
          try {
            await client.container.stop(container, { timeout: 5 })
          } catch {
            /* Already stopped. */
          }
          try {
            await client.container.remove(container, { removeVolumes: true })
          } catch {
            /* Already removed. */
          }
        } catch {
          /* Keep the bounded startup summary if runtime inspection is unavailable. */
        }
      }
      throw new Error(
        `Hatchet fixture startup failed before expected readiness log: ${JSON.stringify({ diagnostics, state })}`,
      )
    }
  }
}

/** Own every fixture resource through both partial setup failure and teardown. */
export async function startHatchetFixture() {
  const network = await new Network().start()
  let postgres: StartedPostgreSqlContainer | undefined
  let hatchet: StartedTestContainer | undefined
  const cleanup = async () => {
    cleanGlobalData()
    if (hatchet) {
      try {
        await hatchet.stop()
      } catch {
        /* Continue own-resource cleanup. */
      }
    }
    if (postgres) {
      try {
        await postgres.stop()
      } catch {
        /* Continue own-resource cleanup. */
      }
    }
    try {
      await network.stop()
    } catch {
      /* Preserve the original setup diagnostic if the runtime is shutting down. */
    }
  }
  try {
    postgres = await getPostgres({ network }).start()
    const postgresUri = `postgresql://${postgres.getUsername()}:${postgres.getPassword()}@db:5432/${postgres.getDatabase()}`
    hatchet = await getHatchetContainer({
      postgresConnectionString: postgresUri,
      network,
    }).start()
    const cmd = await hatchet.exec(
      '/hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 | xargs',
    )
    writeGlobalData({
      token: cmd.stdout.trim(),
      hostAndPort: `localhost:${hatchet.getMappedPort(7077)}`,
      apiUrl: `http://localhost:${hatchet.getMappedPort(8888)}`,
    })
    return cleanup
  } catch (error) {
    await cleanup()
    throw error
  }
}
