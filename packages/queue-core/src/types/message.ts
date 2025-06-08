import { JobDescription } from './job'

export interface MessageBroker {
  connect(): Promise<void>
  publish(props: MessageProducer): Promise<boolean>
  subscribe(props: MessageSubscriber): Promise<void>
}

export interface MessageProducer {
  queueName: string
  data: Record<string, any>
  topic?: string
}

export interface MessageSubscriber {
  queueName: string
  handle: (job: JobDescription) => Promise<void>
  topics?: string[]
  exclusiveQueues?: boolean
}
