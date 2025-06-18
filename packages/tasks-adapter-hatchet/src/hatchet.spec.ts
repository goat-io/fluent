// npx vitest test ./src/hatchet.spec.ts

import { ShouldQueue, UnknownInputType } from '@goatlab/tasks-core'
import { HatchetConnector } from './HatchetConnector'
import { describe, it, expect, beforeAll } from 'vitest'
import { Ids } from '@goatlab/js-utils'

class TestTask extends ShouldQueue<{ text: string }> {
  postUrl = `http://localhost/task/this/url`
  taskName = 'this_is_the_task_name'

  protected getUniqueTaskName(_: { text: string }): string {
    return `test_task_${Ids.uuid()}`
  }

  public async handle(taskBody: UnknownInputType): Promise<void> {
    console.log('Running task with body:', taskBody)
  }
}

const hatchetConnector = new HatchetConnector({
  logLevel: 'DEBUG',
  token: process.env['HATCHET_JWT_TOKEN'] || ''
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
  })
  it('should create a task and run it', async () => {
    const status = await task.queue({ text: 'Hello, World!' })

    expect(status).toHaveProperty('id')
    expect(status).toHaveProperty('name')
    expect(status).toHaveProperty('status', 'QUEUED')
    expect(status).toHaveProperty('attempts', 0)
    expect(status.name).toContain('this_is_the_task_name')
    expect(status).not.toHaveProperty('payload')

    await new Promise(resolve => setTimeout(resolve, 2000))

    const getStatus = await task.getStatus(status.id)

    expect(getStatus).toHaveProperty('id', status.id)
    expect(getStatus).toHaveProperty('name', status.name)
    expect(getStatus).toHaveProperty('status', 'COMPLETED')
    expect(getStatus).toHaveProperty('payload')
    expect(getStatus.payload.text).toBe('Hello, World!')
  })
})
