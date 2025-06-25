// npx vitest test ./src/cloudtask.spec.ts

import { ShouldQueue, UnknownInputType } from '@goatlab/tasks-core'
import { CloudTaskConnector } from './CloudTaskConnector'
import { describe, it, expect } from 'vitest'

class TestTask extends ShouldQueue<{ text: string }> {
  postUrl = `http://localhost/task/this/url`
  taskName = 'this_is_the_task_name'

  public async handle(taskBody: UnknownInputType): Promise<void> {
    console.log('Running task with body:', taskBody)
  }
}

const cloudTask = new CloudTaskConnector({
  gcpServiceAccount: JSON.parse(
    Buffer.from(process.env['FIREBASE_SERVICE_ACCOUNT'], 'base64').toString(
      'utf8'
    )
  ),
  location: 'europe-west1',
  encryptionKey: 'some-encryption-key',
  gcpProject: 'gealium-develop'
})

const task = new TestTask({
  connector: cloudTask
})

describe('CloudTaskQueue', () => {
  it('should create a task and run it', async () => {
    const status = await task.queue({ text: 'Hello, World!' })

    expect(status).toHaveProperty('id')
    expect(status).toHaveProperty('name')
    expect(status).toHaveProperty('status', 'QUEUED')
    expect(status).toHaveProperty('attempts', 0)
    expect(status.name).toContain('this_is_the_task_name')
    expect(status).not.toHaveProperty('payload')

    const getStatus = await task.getStatus(status.id)

    expect(getStatus).toHaveProperty('id', status.id)
    expect(getStatus).toHaveProperty('name', status.name)
    expect(getStatus).toHaveProperty('status', 'FAILED')
    expect(getStatus).toHaveProperty('payload')
    expect(getStatus.payload.text).toBe('Hello, World!')
  })
})
