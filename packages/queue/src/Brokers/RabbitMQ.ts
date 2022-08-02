import { Channel, connect, Connection, Options } from 'amqplib/callback_api'
import { Promises } from '@goatlab/js-utils'
import {
  DataMap,
  JobDescription,
  Repeat,
  RepeatEvery,
  Schedulers,
  TimeZones
} from '../Jobs'
import { Agenda } from '../Schedulers/Agenda'
import { BullScheduler } from '../Schedulers/Bull'
import { BullMQScheduler } from '../Schedulers/BullMQ'
import { NodeScheduler } from '../Schedulers/Node'

export interface RabbitMQProducer {
  queueName: string
  data: DataMap
  topic?: string
}

export interface RabbitMQConsumer {
  queueName: string
  handle: (job: JobDescription) => Promise<void>
  topics?: string[]
  exclusiveQueues?: boolean
}

const connectionOptions: Options.Connect = {
  hostname: process.env.RABBITMQ_HOST,
  password: process.env.RABBITMQ_PASSWORD,
  port: Number(process.env.RABBITMQ_PORT),
  username: process.env.RABBITMQ_USER
}

const connectToMQ = (): Promise<Connection> =>
  new Promise((resolve, reject) => {
    connect(connectionOptions, (error, connection) => {
      if (error) {
        return reject(error)
      }
      resolve(connection)
    })
  })

const createChannel = (connection: Connection): Promise<Channel> =>
  new Promise((resolve, reject) => {
    connection.createChannel((error, channel) => {
      if (error) {
        return reject(error)
      }
      resolve(channel)
    })
  })

interface IJobScheduler {
  data?: DataMap
  jobName: string
  repeat: Repeat
  scheduler: Schedulers
}

/**
 *
 */
const connectToRabbitMQ = async () => {
  const connection = await connectToMQ()

  return connection
}

export const RabbitMQBroker = (() => {
  /**
   *
   * @param options
   */
  const schedule = async (options: IJobScheduler) => {
    const croneString =
      (options.repeat && options.repeat.cronTime) || RepeatEvery.never
    const timezoneString =
      (options.repeat && options.repeat.timeZone) || TimeZones.EuropeStockholm
    const type = options.scheduler
    await produce({ queueName: options.jobName, data: options.data })

    if (type === Schedulers.AGENDA) {
      return Agenda.schedule({
        handle: async job => {
          schedule(options)
        },
        jobName: options.jobName,
        repeat: {
          cronTime: croneString,
          runOnInit: false,
          timeZone: timezoneString
        }
      })
    }

    if (type === Schedulers.BULL) {
      return BullScheduler.schedule({
        handle: async job => {
          schedule(options)
        },
        jobName: options.jobName,
        repeat: {
          cronTime: croneString,
          runOnInit: false,
          timeZone: timezoneString
        }
      })
    }

    if (type === Schedulers.BULLMQ) {
      return BullMQScheduler.schedule({
        handle: async job => {
          schedule(options)
        },
        jobName: options.jobName,
        repeat: {
          cronTime: croneString,
          runOnInit: false,
          timeZone: timezoneString
        }
      })
    }

    if (type === Schedulers.NODE) {
      return NodeScheduler.schedule({
        handle: async job => {
          schedule(options)
        },
        jobName: options.jobName,
        repeat: {
          cronTime: croneString,
          runOnInit: false,
          timeZone: timezoneString
        }
      })
    }
  }
  /**
   *
   * @param queueName
   * @param data
   */
  const produce = async ({
    queueName,
    data,
    topic
  }: RabbitMQProducer): Promise<Channel> => {
    const connection = await connectToRabbitMQ()
    const channel = await createChannel(connection)
    const msg = JSON.stringify(data)

    if (!topic) {
      topic = 'default'
    }

    channel.assertExchange(queueName, 'topic', {
      durable: true
    })
    channel.publish(queueName, topic, Buffer.from(msg))
    console.log(" [x] Sent %s:'%s'", topic, msg)
    return channel
  }
  /**
   *
   * @param queueName
   * @param handle
   */
  const consume = async ({
    queueName,
    handle,
    topics,
    exclusiveQueues
  }: RabbitMQConsumer): Promise<Channel> => {
    const connection = await connectToRabbitMQ()
    const channel = await createChannel(connection)

    if (!topics) {
      topics = ['default']
    }

    channel.assertExchange(queueName, 'topic', {
      durable: true
    })

    channel.assertQueue(
      exclusiveQueues ? '' : queueName,
      {
        exclusive: !!exclusiveQueues
      },
      (error, q) => {
        if (error) {
          throw error
        }

        topics.forEach(topic => {
          channel.bindQueue(q.queue, queueName, topic)
        })

        console.log(' [*] Waiting for logs. To exit press CTRL+C')

        channel.consume(
          q.queue,
          async msg => {
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
              console.log('Could not process the job', msg)
            }
          },
          {
            noAck: false
          }
        )
      }
    )

    return channel
  }

  return Object.freeze({ produce, consume })
})()
