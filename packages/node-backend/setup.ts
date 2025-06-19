import { RabbitMQContainer } from '@testcontainers/rabbitmq'
import { KafkaContainer } from '@testcontainers/kafka'
import { writeFileSync } from 'fs'
import * as fs from 'fs'
import { resolve } from 'path'
// This file runs before jest sets the env
// so we need to load dotenv manually if we want to use env

export const rabbit = new RabbitMQContainer(
  'rabbitmq:3.12.11-management-alpine'
)

const kafka = await new KafkaContainer('confluentinc/cp-kafka:7.9.0')

export default async () => {
  // Replace this with your actual async function
  const rabbitMQContainer = await rabbit.start()
  const kafkaContainer = await kafka.start()

  const rabbitMQUrl = `amqp://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(
    5672
  )}`

  const kafkaUrl = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(
    9093
  )}`

  console.log({ kafkaUrl })

  const data = {
    rabbitMQUrl,
    kafkaUrl
  }

  const filePath = resolve(__dirname, 'tempData.json')
  writeFileSync(filePath, JSON.stringify(data), 'utf-8')

  return async () => {
    await rabbitMQContainer.stop()
    await kafkaContainer.stop()
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}
