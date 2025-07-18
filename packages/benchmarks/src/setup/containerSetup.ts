import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql'
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis'
import { writeFileSync, existsSync, unlinkSync } from 'fs'
import { resolve } from 'path'

export interface ContainerData {
  mysql: {
    host: string
    port: number
    username: string
    password: string
    database: string
    connectionString: string
  }
  redis: {
    host: string
    port: number
    connectionString: string
  }
}

let mysqlContainer: StartedMySqlContainer
let redisContainer: StartedRedisContainer

export default async function setup() {
  console.log('🐳 Starting test containers...')
  
  // Start MySQL container
  console.log('📦 Starting MySQL container...')
  mysqlContainer = await new MySqlContainer('mysql:8.0')
    .withDatabase('benchmark_db')
    .withUsername('benchmark_user')
    .withUserPassword('benchmark_pass')
    .withRootPassword('root_pass')
    .withExposedPorts(3306)
    .start()

  // Start Redis container
  console.log('📦 Starting Redis container...')
  redisContainer = await new RedisContainer('redis:7.2')
    .withExposedPorts(6379)
    .start()

  const containerData: ContainerData = {
    mysql: {
      host: mysqlContainer.getHost(),
      port: mysqlContainer.getMappedPort(3306),
      username: mysqlContainer.getUsername(),
      password: mysqlContainer.getUserPassword(),
      database: mysqlContainer.getDatabase(),
      connectionString: `mysql://${mysqlContainer.getUsername()}:${mysqlContainer.getUserPassword()}@${mysqlContainer.getHost()}:${mysqlContainer.getMappedPort(3306)}/${mysqlContainer.getDatabase()}`
    },
    redis: {
      host: redisContainer.getHost(),
      port: redisContainer.getMappedPort(6379),
      connectionString: redisContainer.getConnectionUrl()
    }
  }

  // Save container data to file
  const filePath = resolve(__dirname, '../../tempData.json')
  writeFileSync(filePath, JSON.stringify(containerData, null, 2), 'utf-8')

  console.log('✅ Test containers started successfully!')
  console.log(`📊 MySQL: ${containerData.mysql.connectionString}`)
  console.log(`🔴 Redis: ${containerData.redis.connectionString}`)

  return async () => {
    console.log('🛑 Stopping test containers...')
    
    await Promise.all([
      mysqlContainer?.stop(),
      redisContainer?.stop()
    ])

    // Cleanup temp file
    const filePath = resolve(__dirname, '../../tempData.json')
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }

    console.log('✅ Test containers stopped successfully!')
  }
}