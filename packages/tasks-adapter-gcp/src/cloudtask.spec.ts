// npx vitest test ./src/cloudtask.spec.ts

import { ShouldQueue, UnknownInputType } from '@goatlab/tasks-core'
import { CloudTaskConnector } from './CloudTaskConnector'
import { describe, it, expect, beforeAll } from 'vitest'

class TestTask extends ShouldQueue<{ text: string }> {
  postUrl = `http://localhost/task/this/url`
  taskName = 'this_is_the_task_name'

  public async handle(taskBody: UnknownInputType): Promise<void> {
    console.log('Running task with body:', taskBody)
  }
}

describe('CloudTaskQueue', () => {
  let cloudTask: CloudTaskConnector
  let task: TestTask

  beforeAll(() => {
    // Check if we have the required environment variable
    const serviceAccountBase64 = process.env['FIREBASE_SERVICE_ACCOUNT']
    
    if (!serviceAccountBase64) {
      console.warn('FIREBASE_SERVICE_ACCOUNT not found, skipping CloudTask tests')
      return
    }

    try {
      // Decode and parse the service account
      const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8')
      const gcpServiceAccount = JSON.parse(serviceAccountJson)
      
      cloudTask = new CloudTaskConnector({
        gcpServiceAccount,
        location: 'europe-west1',
        encryptionKey: 'some-encryption-key',
        gcpProject: 'gealium-develop'
      })

      task = new TestTask({
        connector: cloudTask
      })
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', error)
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT format: ${error.message}`)
    }
  })

  it('should create a task and run it', async () => {
    // Skip test if cloudTask wasn't initialized
    if (!cloudTask) {
      console.log('Skipping test: FIREBASE_SERVICE_ACCOUNT not available')
      return
    }

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