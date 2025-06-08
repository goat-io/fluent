import { Channel, connect, Connection, Options } from 'amqplib'
import { Promises } from '@goatlab/js-utils'
import type { JobDescription } from '../types/job'
import type {
  MessageBroker,
  MessageProducer,
  MessageSubscriber
} from '../types/message'
import { randomUUID } from 'crypto'

export class RabbitMQBroker implements MessageBroker {
  private connectionOptions: Options.Connect | string = ''
  private publisherConnection?: Connection
  private consumerConnection?: Connection
  private publisherChannel?: Channel
  private consumerChannel?: Channel

  constructor(options: Options.Connect | string) {
    this.connectionOptions = options
  }

  async connect(): Promise<void> {
    this.publisherConnection = await connect(this.connectionOptions)
    this.publisherChannel = await this.publisherConnection.createChannel()

    this.consumerConnection = await connect(this.connectionOptions)
    this.consumerChannel = await this.consumerConnection.createChannel()
    await this.consumerChannel.prefetch(1)
  }

  //  /**
  //  *
  //  * @param options
  //  */
  //  const schedule = async (options: IJobScheduler) => {
  //   const cronString: RepeatEvery =
  //     (options.repeat && options.repeat.cronTime) || 'never'

  //   const timezoneString: TimeZones =
  //     (options.repeat && options.repeat.timeZone) || 'Europe/Stockholm'
  //   const type: Schedulers = options.scheduler

  //   await produce({ queueName: options.jobName, data: options.data })

  //   if (type === 'agenda') {
  //     return Agenda.schedule({
  //       handle: async job => {
  //         schedule(options)
  //       },
  //       jobName: options.jobName,
  //       repeat: {
  //         cronTime: cronString,
  //         runOnInit: false,
  //         timeZone: timezoneString
  //       }
  //     })
  //   }

  //   if (type === 'bull') {
  //     return BullScheduler.schedule({
  //       handle: async job => {
  //         schedule(options)
  //       },
  //       jobName: options.jobName,
  //       repeat: {
  //         cronTime: cronString,
  //         runOnInit: false,
  //         timeZone: timezoneString
  //       }
  //     })
  //   }

  //   if (type === 'bullmq') {
  //     return BullMQScheduler.schedule({
  //       handle: async job => {
  //         schedule(options)
  //       },
  //       jobName: options.jobName,
  //       repeat: {
  //         cronTime: cronString,
  //         runOnInit: false,
  //         timeZone: timezoneString
  //       }
  //     })
  //   }

  //   if (type === 'node') {
  //     return NodeScheduler.schedule({
  //       handle: async job => {
  //         schedule(options)
  //       },
  //       jobName: options.jobName,
  //       repeat: {
  //         cronTime: cronString,
  //         runOnInit: false,
  //         timeZone: timezoneString
  //       }
  //     })
  //   }
  // }

  /**
   *
   * Published data to a RabbitMQ queue
   * The format is based on the default format
   * created for this library to publish in different
   * message brokers, using the same dev API
   *
   * @param queueName
   * @param data
   */
  async publish({
    queueName,
    data,
    topic = 'topic'
  }: MessageProducer): Promise<boolean> {
    if (!this.publisherChannel) {
      throw new Error(
        'RabbitMQ is not connected. Did you call the connect() method?'
      )
    }

    const msg = JSON.stringify(data)

    await this.publisherChannel.assertExchange(queueName, 'topic', {
      durable: true
    })

    const messageSent = this.publisherChannel.publish(
      queueName,
      topic,
      Buffer.from(msg),
      { messageId: randomUUID() }
    )

    return messageSent
  }

  /**
   *
   * @param queueName
   * @param handle
   */
  async subscribe({
    queueName,
    handle,
    topics = ['default'],
    exclusiveQueues
  }: MessageSubscriber): Promise<void> {
    if (!this.consumerChannel) {
      throw new Error(
        'RabbitMQ is not connected. Did you call the connect() method?'
      )
    }

    await this.consumerChannel.assertExchange(queueName, 'topic', {
      durable: true
    })

    const q = await this.consumerChannel.assertQueue(
      exclusiveQueues ? '' : queueName,
      { exclusive: !!exclusiveQueues }
    )

    for (const topic of topics) {
      await this.consumerChannel.bindQueue(q.queue, queueName, topic)
    }

    await this.consumerChannel.consume(
      q.queue,
      async msg => {
        if (!msg) return

        const data = JSON.parse(msg.content.toString() || '{}')
        const topic = msg.fields.routingKey

        const jobDescription: JobDescription = {
          data,
          id: msg.properties.messageId,
          instance: msg,
          name: topic
        }

        const [error] = await Promises.try(handle(jobDescription))
        if (error) {
          console.error('Could not process the job', msg)
        } else {
          this.consumerChannel.ack(msg)
        }
      },
      { noAck: false }
    )
  }

  async close(): Promise<void> {
    await this.publisherChannel?.close()
    await this.publisherConnection?.close()
    await this.consumerChannel?.close()
    await this.consumerConnection?.close()
  }
}
