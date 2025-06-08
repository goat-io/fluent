import * as fastq from 'fastq'
import type { queueAsPromised } from 'fastq'
import { randomUUID } from 'crypto'
import { Promises } from '@goatlab/js-utils'
import type { JobDescription } from '../types/job'
import type {
  MessageBroker,
  MessageProducer,
  MessageSubscriber
} from '../types/message'

type InternalTask = {
  id: string
  topic: string
  data: unknown
  queueName: string
}

export class FastQBroker implements MessageBroker {
  private queue: queueAsPromised<InternalTask>
  private handlerMap = new Map<string, (job: JobDescription) => Promise<void>>()

  constructor() {
    this.queue = fastq.promise(this.worker.bind(this), 1)
  }

  async connect(): Promise<void> {
    // No-op for fastq
  }

  async publish({
    queueName,
    data,
    topic = 'topic'
  }: MessageProducer): Promise<boolean> {
    const task: InternalTask = {
      id: randomUUID(),
      data,
      topic,
      queueName
    }

    await this.queue.push(task)
    return true
  }

  async subscribe({
    queueName,
    handle,
    topics = ['default']
  }: MessageSubscriber): Promise<void> {
    for (const topic of topics) {
      const key = this.getKey(queueName, topic)
      this.handlerMap.set(key, handle)
    }
  }

  private async worker(task: InternalTask): Promise<void> {
    const key = this.getKey(task.queueName, task.topic)
    const handler = this.handlerMap.get(key)

    if (!handler) return

    const job: JobDescription = {
      id: task.id,
      name: task.topic,
      data: task.data,
      instance: task
    }

    const [error] = await Promises.try(handler(job))
    if (error) {
      console.error('Could not process the job', error)
    }
  }

  private getKey(queue: string, topic: string): string {
    return `${queue}::${topic}`
  }

  async close(): Promise<void> {
    // No-op for fastq
  }
}
