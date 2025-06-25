import { RedisContainer } from '@testcontainers/redis'
import { KafkaContainer } from '@testcontainers/kafka'
import { writeFileSync } from 'fs'
import * as fs from 'fs'
import { resolve } from 'path'
// This file runs before jest sets the env
// so we need to load dotenv manually if we want to use env

const redis = await new RedisContainer('redis:7.2')

export default async () => {
  // Replace this with your actual async function
  const redisContainer = await redis.start()

  const redisUrl = redisContainer.getConnectionUrl()

  const data = {
    redisUrl
  }

  const filePath = resolve(__dirname, 'tempData.json')
  writeFileSync(filePath, JSON.stringify(data), 'utf-8')

  return async () => {
    await redisContainer.stop()

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}
