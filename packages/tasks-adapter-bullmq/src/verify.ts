/**
 * Verify tasks are actually in Redis
 * Run: npx tsx src/verify.ts
 */

import type { TaskConnector } from '@goatlab/tasks-core'
import { ShouldQueue } from '@goatlab/tasks-core'
import { RedisContainer } from '@testcontainers/redis'
import Redis from 'ioredis'
import { BullMQConnector } from './BullMQConnector.js'

class Task extends ShouldQueue<{ i: number }> {
  postUrl = 'http://localhost/test'
  taskName = 'verify_task'
  constructor(c: TaskConnector<{ i: number }>) {
    super({ connector: c })
  }
  async handle(): Promise<undefined> {
    return undefined
  }
}

async function main() {
  const container = await new RedisContainer('redis:7-alpine').start()
  const host = container.getHost()
  const port = container.getMappedPort(6379)
  console.log('Redis:', `${host}:${port}`)

  const connector = new BullMQConnector({ connection: { host, port } })
  const task = new Task(connector)

  // Queue 10,000 tasks
  const COUNT = 10000
  console.log(`\nQueuing ${COUNT} tasks...`)
  const start = Date.now()
  const promises = []
  for (let i = 0; i < COUNT; i++) {
    promises.push(task.queue({ i }))
  }
  await Promise.all(promises)
  const elapsed = Date.now() - start
  console.log(
    `Time: ${elapsed}ms (${Math.round((COUNT / elapsed) * 1000)} tasks/sec)`,
  )

  // Query Redis directly
  const redis = new Redis({ host, port })

  // Count jobs in the queue
  const waiting = await redis.llen('bull:verify_task:wait')
  const delayed = await redis.zcard('bull:verify_task:delayed')
  const active = await redis.llen('bull:verify_task:active')

  console.log('\n📊 Redis verification:')
  console.log(`  Waiting jobs (LLEN bull:verify_task:wait): ${waiting}`)
  console.log(`  Delayed jobs (ZCARD bull:verify_task:delayed): ${delayed}`)
  console.log(`  Active jobs (LLEN bull:verify_task:active): ${active}`)
  console.log(`  Total in queue: ${waiting + delayed + active}`)

  // Also check via BullMQ API
  const counts = await connector.getJobCounts('verify_task')
  console.log('\n📊 BullMQ getJobCounts():')
  console.log(`  ${JSON.stringify(counts)}`)

  await redis.quit()
  await connector.close()
  await container.stop()
}

main().catch(console.error)
