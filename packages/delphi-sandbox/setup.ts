// Global test setup: starts Redis + Postgres containers for E2E tests
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const TEMP_DATA_PATH = join(__dirname, 'tempData.json')

export default async () => {
  if (existsSync(TEMP_DATA_PATH)) unlinkSync(TEMP_DATA_PATH)

  const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
  const { RedisContainer } = await import('@testcontainers/redis')

  const redis = await new RedisContainer('redis:7-alpine').start()
  const postgres = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('agents_sandbox_test')
    .start()

  writeFileSync(
    TEMP_DATA_PATH,
    JSON.stringify({
      redis: {
        host: redis.getHost(),
        port: redis.getMappedPort(6379),
      },
      postgres: {
        host: postgres.getHost(),
        port: postgres.getMappedPort(5432),
        database: 'agents_sandbox_test',
        username: postgres.getUsername(),
        password: postgres.getPassword(),
      },
    }),
  )

  return async () => {
    await redis.stop()
    await postgres.stop()
    if (existsSync(TEMP_DATA_PATH)) unlinkSync(TEMP_DATA_PATH)
  }
}
