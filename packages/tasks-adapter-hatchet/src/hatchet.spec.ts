// npx vitest test ./src/hatchet.spec.ts

import { Ids } from '@goatlab/js-utils'
import { ShouldQueue, UnknownInputType } from '@goatlab/tasks-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { HatchetConnector } from './HatchetConnector'
import { getGlobalData } from './test/const'

class TestTask extends ShouldQueue<{ text: string }> {
  postUrl = `http://localhost/task/this/url`
  taskName = 'this_is_the_task_name'

  protected getUniqueTaskName(_: { text: string }): string {
    return `test_task_${Ids.uuid()}`
  }

  public async handle(taskBody: UnknownInputType): Promise<undefined> {
    console.log('Running task with body:', taskBody)
    return undefined
  }
}

const hatchetConnector = new HatchetConnector({
  logLevel: 'DEBUG',
  token: getGlobalData().token || process.env.HATCHET_JWT_TOKEN || '',
  hostAndPort: getGlobalData().hostAndPort,
  apiUrl: getGlobalData().apiUrl
})

const task = new TestTask({
  connector: hatchetConnector
})

describe('HatcherConnector', () => {
  beforeAll(async () => {
    await hatchetConnector.startWorker({
      workerName: 'backend-worker',
      tasks: [task],
      slots: 100
    })
    // Wait for the hatchet worker to be ready to accept connections/messages
    await new Promise(resolve => setTimeout(resolve, 20_000))
  }, 40_000)

  it('should create a task and run it', async () => {
    const status = await task.queue({ text: 'Hello, World!' })

    expect(status).toHaveProperty('id')
    expect(status).toHaveProperty('name')
    expect(status).toHaveProperty('status', 'QUEUED')
    expect(status).toHaveProperty('attempts', 0)
    expect(status.name).toContain('this_is_the_task_name')
    expect(status).not.toHaveProperty('payload')

    await new Promise(resolve => setTimeout(resolve, 2_000))

    const getStatus = await task.getStatus(status.id)

    expect(getStatus).toHaveProperty('id', status.id)
    expect(getStatus).toHaveProperty('name', status.name)
    expect(getStatus).toHaveProperty('status', 'COMPLETED')
    expect(getStatus).toHaveProperty('payload')
    expect(getStatus.payload.text).toBe('Hello, World!')
  })
})
