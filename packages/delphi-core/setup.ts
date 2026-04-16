// Global test setup: starts Redis + Postgres containers shared across all tests
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer } from '@testcontainers/redis'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const TEMP_DATA_PATH = join(__dirname, 'tempData.json')

export interface GlobalTestData {
  redis: { host: string; port: number }
  postgres: {
    host: string
    port: number
    database: string
    username: string
    password: string
  }
}

export function getGlobalData(): GlobalTestData {
  return JSON.parse(
    require('node:fs').readFileSync(TEMP_DATA_PATH, 'utf-8'),
  )
}

export function writeGlobalData(data: GlobalTestData): void {
  writeFileSync(TEMP_DATA_PATH, JSON.stringify(data))
}

export function cleanGlobalData(): void {
  if (existsSync(TEMP_DATA_PATH)) {
    unlinkSync(TEMP_DATA_PATH)
  }
}

export default async () => {
  // Clean stale tempData.json from a previous run that crashed before
  // teardown — avoids tests reading outdated container connection info.
  cleanGlobalData()

  const redis = await new RedisContainer('redis:7-alpine').start()
  const postgres = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('agents_test')
    .start()

  writeGlobalData({
    redis: {
      host: redis.getHost(),
      port: redis.getMappedPort(6379),
    },
    postgres: {
      host: postgres.getHost(),
      port: postgres.getMappedPort(5432),
      database: 'agents_test',
      username: postgres.getUsername(),
      password: postgres.getPassword(),
    },
  })

  return async () => {
    await redis.stop()
    await postgres.stop()
    cleanGlobalData()
  }
}
