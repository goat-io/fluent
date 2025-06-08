import { beforeAll, afterAll, it, expect, vi } from 'vitest'
import type { MessageBroker } from '../types/message'

export function runMessageBrokerTestSuite(broker: MessageBroker) {
  const queueName = 'TestQueue'
  const exchangeName = 'TestExchange'

  beforeAll(async () => {
    await broker.connect()
  })

  afterAll(async () => {
    // await broker.close()
  })

  it('should connect and publish a message', async () => {
    const messageSent = await broker.publish({
      queueName,
      data: { myData: 'hello' }
    })

    expect(messageSent).toBe(true)
  })

  it('should consume a message and acknowledge it', async () => {
    let resolvePromise: () => void
    const messageHandled = new Promise<void>(res => {
      resolvePromise = res
    })

    const handle = vi.fn(async () => {
      resolvePromise()
    })

    await broker.subscribe({
      queueName,
      handle,
      topics: ['topic']
    })

    await broker.publish({
      queueName,
      data: { myData: 'consume-test' },
      topic: 'topic'
    })

    await messageHandled

    expect(handle).toHaveBeenCalled()
    const job = (handle.mock.calls.at(0) as any)[0]
    expect(job?.data.myData).toBe('consume-test')
  })

  it(
    'should handle multiple topics',
    async () => {
      let resolvePromise: () => void
      const messageHandled = new Promise<void>((res, rej) => {
        resolvePromise = res
        setTimeout(() => rej(new Error('Message not handled in time')), 9000)
      })

      const handle = vi.fn(async () => {
        resolvePromise()
      })

      await broker.subscribe({
        queueName: exchangeName,
        handle,
        topics: ['topic.a', 'topic.b']
      })

      await broker.publish({
        queueName: exchangeName,
        data: { myData: 'topic-a' },
        topic: 'topic.a'
      })

      await messageHandled

      expect(handle).toHaveBeenCalled()
      const job = (handle.mock.calls.at(0) as any)[0]
      expect(job?.name).toBe('topic.a')
    },
    { timeout: 10_000 }
  )

  it('should support exclusive queue simulation', async () => {
    let resolvePromise: () => void
    const messageHandled = new Promise<void>((res, rej) => {
      resolvePromise = res
      setTimeout(() => rej(new Error('Message not handled in time')), 9000)
    })

    const handle = vi.fn(async () => {
      resolvePromise()
    })

    await broker.subscribe({
      queueName,
      handle,
      topics: ['exclusive.test'],
      exclusiveQueues: true
    })

    await broker.publish({
      queueName,
      data: { myData: 'exclusive-queue' },
      topic: 'exclusive.test'
    })

    await messageHandled

    expect(handle).toHaveBeenCalled()
  })
}
