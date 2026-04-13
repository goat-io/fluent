import { RabbitMQContainer } from '@testcontainers/rabbitmq'
import { Wait } from 'testcontainers'
import { cleanGlobalData, writeGlobalData } from './src/test/const'

export default async () => {
  const rabbitMQContainer = await new RabbitMQContainer(
    'rabbitmq:3.12.11-management-alpine',
  )
    .withWaitStrategy(
      Wait.forLogMessage(/Server startup complete/, 1),
    )
    .withStartupTimeout(120_000)
    .start()

  const rabbitMQUrl = `amqp://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(
    5672
  )}`

  writeGlobalData({ rabbitMQUrl })

  return async () => {
    await rabbitMQContainer.stop()
    cleanGlobalData()
  }
}
