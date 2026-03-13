import { KafkaContainer } from '@testcontainers/kafka'
import { RabbitMQContainer } from '@testcontainers/rabbitmq'
import { cleanGlobalData, writeGlobalData } from './src/test/const'

export default async () => {
  const rabbitMQContainer = await new RabbitMQContainer(
    'rabbitmq:3.12.11-management-alpine',
  ).start()
  const kafkaContainer = await new KafkaContainer(
    'confluentinc/cp-kafka:7.9.0',
  ).start()

  const rabbitMQUrl = `amqp://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(
    5672
  )}`

  const kafkaUrl = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(
    9093
  )}`

  writeGlobalData({ rabbitMQUrl, kafkaUrl })

  return async () => {
    await rabbitMQContainer.stop()
    await kafkaContainer.stop()
    cleanGlobalData()
  }
}
