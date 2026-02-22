import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ContainerData } from '../setup/containerSetup'

export function getContainerData(): ContainerData {
  const filePath = resolve(__dirname, '../../tempData.json')

  if (!existsSync(filePath)) {
    throw new Error(
      'Container data file not found. Make sure to run tests with container setup.',
    )
  }

  const data = JSON.parse(readFileSync(filePath, 'utf-8'))
  return data as ContainerData
}

export function getMySqlConfig() {
  const containerData = getContainerData()
  return {
    host: containerData.mysql.host,
    port: containerData.mysql.port,
    user: containerData.mysql.username,
    password: containerData.mysql.password,
    database: containerData.mysql.database,
  }
}

export function getRedisConfig() {
  const containerData = getContainerData()
  return {
    host: containerData.redis.host,
    port: containerData.redis.port,
    connectionString: containerData.redis.connectionString,
  }
}

export function getDatabaseUrl() {
  const containerData = getContainerData()
  return containerData.mysql.connectionString
}
