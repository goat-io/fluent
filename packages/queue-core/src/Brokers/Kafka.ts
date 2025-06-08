import { Kafka, Producer, Consumer } from 'kafkajs'
import { Promises } from '@goatlab/js-utils'
import type { JobDescription } from '../types/job'
import type {
  MessageBroker,
  MessageProducer,
  MessageSubscriber
} from '../types/message'
import { randomUUID } from 'crypto'

export class KafkaBroker implements MessageBroker {
  private kafka: Kafka
  private producer?: Producer
  private consumer?: Consumer

  constructor(brokers: string[], clientId = 'my-app') {
    this.kafka = new Kafka({ clientId, brokers })
  }

  async connect(): Promise<void> {
    this.producer = this.kafka.producer()
    await this.producer.connect()
  }

  async publish({
    queueName,
    data,
    topic = 'default'
  }: MessageProducer): Promise<boolean> {
    if (!this.producer) {
      throw new Error(
        'Kafka producer is not connected. Did you call the connect() method?'
      )
    }

    const message = {
      key: randomUUID(),
      value: JSON.stringify(data)
    }

    await this.producer.send({
      topic,
      messages: [message]
    })

    return true
  }

  async subscribe({
    queueName,
    handle,
    topics = ['default']
  }: MessageSubscriber): Promise<void> {
    this.consumer = this.kafka.consumer({ groupId: queueName })
    await this.consumer.connect()

    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: true })
    }

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const data = JSON.parse(message.value?.toString() || '{}')

        const jobDescription: JobDescription = {
          data,
          id: message.key?.toString() || '',
          instance: message,
          name: topic
        }

        const [error] = await Promises.try(handle(jobDescription))
        if (error) {
          console.error('Could not process the job', message)
        }
      }
    })
  }

  async close(): Promise<void> {
    await this.producer?.disconnect()
    await this.consumer?.disconnect()
  }
}
