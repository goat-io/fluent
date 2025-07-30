import * as fs from 'node:fs'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { KafkaContainer } from '@testcontainers/kafka'
import { RabbitMQContainer } from '@testcontainers/rabbitmq'
// This file runs before jest sets the env
// so we need to load dotenv manually if we want to use env

export const rabbit = new RabbitMQContainer(
  'rabbitmq:3.12.11-management-alpine'
)

const kafka = new KafkaContainer('confluentinc/cp-kafka:7.9.0')

export default async () => {
  // Check if we need containers by looking for integration tests
  // Only start containers if we have tests that actually need them
  const hasIntegrationTests =
    process.env.RUN_INTEGRATION_TESTS === 'true' ||
    process.env.NODE_ENV === 'integration'

  const filePath = resolve(__dirname, 'tempData.json')

  if (!hasIntegrationTests) {
    // For unit tests, just create empty tempData file and return
    writeFileSync(filePath, JSON.stringify({}), 'utf-8')
    return async () => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
  }

  // Start containers for integration tests
  const rabbitMQContainer = await rabbit.start()
  const kafkaContainer = await kafka.start()

  const rabbitMQUrl = `amqp://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(
    5672
  )}`

  const kafkaUrl = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(
    9093
  )}`

  const data = {
    rabbitMQUrl,
    kafkaUrl
  }

  writeFileSync(filePath, JSON.stringify(data), 'utf-8')

  return async () => {
    await rabbitMQContainer.stop()
    await kafkaContainer.stop()
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}
