// pnpm --filter @goatlab/tasks-adapter-hatchet exec vitest run --config src/test/fixture.vitest.config.ts
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createStartupDiagnostics,
  matchesExpectedTenantCreation,
  startHatchetFixture,
} from './hatchet.js'

const m = vi.hoisted(() => ({
  stop: vi.fn(),
  remove: vi.fn(),
  pgStop: vi.fn(),
  networkStop: vi.fn(),
  clean: vi.fn(),
  write: vi.fn(),
  events: [] as string[],
}))
vi.mock('testcontainers', () => ({
  Network: class {
    async start() {
      return { stop: m.networkStop }
    }
  },
  GenericContainer: class {
    consumer?: (stream: PassThrough) => void
    withEnvironment() {
      return this
    }
    withNetwork() {
      return this
    }
    withExposedPorts() {
      return this
    }
    withWaitStrategy() {
      return this
    }
    withLogConsumer(consumer: (stream: PassThrough) => void) {
      this.consumer = consumer
      return this
    }
    async start() {
      await (this as any).containerCreated('owned-fixture-id')
      const stream = new PassThrough()
      this.consumer?.(stream)
      stream.write(
        'fatal database migration failed password=not-a-real-password token=not-a-real-token DATABASE_URL=postgres://user:pass@db/db\n',
      )
      throw new Error('Expected tenant log not received after 60000ms')
    }
  },
  Wait: { forLogMessage: () => ({ withStartupTimeout: () => ({}) }) },
  getContainerRuntimeClient: async () => ({
    container: {
      getById: (id: string) => {
        expect(id).toBe('owned-fixture-id')
        return { id }
      },
      inspect: async () => ({
        State: {
          Running: false,
          ExitCode: 1,
          OOMKilled: false,
          Status: 'exited',
        },
        Image: `sha256:${'a'.repeat(64)}`,
      }),
      stop: m.stop,
      remove: m.remove,
    },
  }),
}))
vi.mock('./postgres.js', () => ({
  getPostgres: () => ({
    start: async () => ({
      stop: m.pgStop,
      getName: () => '/owned-db',
      getMappedPort: () => 5432,
      getDatabase: () => 'fixture',
      getUsername: () => 'fixture',
      getPassword: () => 'fixture',
    }),
  }),
}))
vi.mock('./const.js', () => ({
  cleanGlobalData: m.clean,
  writeGlobalData: m.write,
}))
beforeEach(() => {
  vi.clearAllMocks()
  m.events = []
  m.stop.mockImplementation(async () => {
    m.events.push('engine-stop')
  })
  m.remove.mockImplementation(async () => {
    m.events.push('engine-remove')
  })
  m.pgStop.mockImplementation(async () => {
    m.events.push('postgres-stop')
  })
  m.networkStop.mockImplementation(async () => {
    m.events.push('network-stop')
  })
})
describe('Hatchet fixture diagnostics', () => {
  it('reports a safe same-line log shape and proposed match without accepting other tenants or unrelated lines', () => {
    const id = '707d0855-80ab-4e1f-a156-f1c4546cbf52'
    const logs = createStartupDiagnostics()
    logs.append(
      `INFO Created tenant: {"name":"not-a-real-secret","id":"${id}"} password=not-a-real-password`,
    )
    const summary = logs.summary()
    expect(summary.proposedReadinessMatch).toBe(true)
    expect(summary.caseInsensitiveExactMatch).toBe(false)
    expect(summary.tenantIdBeforeMarkerSameLine).toBe(false)
    expect(summary.safeTenantCreationForm).not.toContain('not-a-real-secret')
    expect(summary.safeTenantCreationForm).not.toContain('not-a-real-password')
    expect(matchesExpectedTenantCreation(summary.safeTenantCreationForm!)).toBe(
      true,
    )
    expect(
      matchesExpectedTenantCreation(
        'created tenant 11111111-1111-1111-1111-111111111111',
      ),
    ).toBe(false)
    expect(matchesExpectedTenantCreation(`created tenant\n${id}`)).toBe(false)
  })

  it('bounds retained logs and emits classifications without raw credentials or environment values', () => {
    const log = createStartupDiagnostics()
    log.append('x'.repeat(100000))
    log.append(
      'fatal database migration failed token=not-a-real-token DATABASE_URL=postgres://user:pass@db/db SERVER_DEFAULT_ENGINE_VERSION=V1\n',
    )
    const summary = log.summary()
    expect(summary.recentLogChars).toBeLessThanOrEqual(32768)
    expect(summary.classifications).toContain('database_migration_failed')
    const serialized = JSON.stringify(summary)
    expect(serialized).not.toContain('not-a-real-token')
    expect(serialized).not.toContain('postgres://')
    expect(serialized).not.toContain('=V1')
  })
  it('preserves diagnostic cause before cleaning only its own engine, database and network on setup failure', async () => {
    await expect(startHatchetFixture()).rejects.toThrow(
      /database_migration_failed/,
    )
    expect(m.events).toEqual([
      'engine-stop',
      'engine-remove',
      'postgres-stop',
      'network-stop',
    ])
    expect(m.clean).toHaveBeenCalledOnce()
    expect(m.write).not.toHaveBeenCalled()
  })
})
