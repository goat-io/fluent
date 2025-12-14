// npx vitest run ./src/cloudtask.spec.ts

import { ShouldQueue } from '@goatlab/tasks-core'
import { taskConnectorTestSuite } from '@goatlab/tasks-core/test-suite'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest'
import { CloudTaskConnector } from './CloudTaskConnector.js'

// Parse service account from env
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT

if (!serviceAccountBase64) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is required')
}

const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString(
  'utf8'
)
const gcpServiceAccount = JSON.parse(serviceAccountJson)

// Create real GCP Cloud Tasks connector
const cloudTaskConnector = new CloudTaskConnector({
  gcpServiceAccount,
  location: 'europe-west1',
  encryptionKey: 'test-encryption-key-32chars!!!!',
  gcpProject: gcpServiceAccount.project_id
})

// Run the standardized test suite
// Note: GCP Cloud Tasks uses HTTP callbacks, not workers.
// For lifecycle tests, tasks will fail because there's no real HTTP endpoint.
// We skip lifecycle tests since GCP doesn't have a startWorker concept.
taskConnectorTestSuite(
  { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach },
  () => cloudTaskConnector,
  {
    taskCompletionTimeout: 30000,
    statusCheckInterval: 2000,
    // Skip lifecycle tests - GCP Cloud Tasks doesn't use workers,
    // it uses HTTP callbacks. Without a real HTTP server, tasks will fail.
    skipLifecycleTests: true,
    // No startWorker for GCP - it's HTTP callback based
    startWorker: undefined
  }
)

// GCP-specific tests for the HTTP callback model
describe('CloudTaskConnector GCP-Specific Tests', () => {
  it('should queue a task and get its status', async () => {
    class TestTask extends ShouldQueue<{ text: string }> {
      postUrl = 'https://httpbin.org/post'
      taskName = 'gcp_test_task'

      constructor() {
        super({ connector: cloudTaskConnector })
      }

      public async handle(): Promise<undefined> {
        return undefined
      }
    }

    const task = new TestTask()
    const status = await task.queue({ text: 'Hello GCP!' })

    expect(status).toHaveProperty('id')
    expect(status).toHaveProperty('name')
    expect(status).toHaveProperty('status', 'QUEUED')
    expect(status).toHaveProperty('attempts', 0)
    expect(status.name).toContain('gcp_test_task')

    // Get status - task may have already been dispatched or completed
    // GCP Cloud Tasks removes completed tasks, so payload may be empty if task completed quickly
    const fullStatus = await task.getStatus(status.id)

    expect(fullStatus).toHaveProperty('id')
    // If task still exists, check payload; if completed/removed, payload will be empty
    if (
      fullStatus.status !== 'COMPLETED' ||
      Object.keys(fullStatus.payload).length > 0
    ) {
      expect(fullStatus.payload).toHaveProperty('text', 'Hello GCP!')
    }
  })

  it('should queue task with valid but unreachable endpoint', async () => {
    class UnreachableTask extends ShouldQueue<{ text: string }> {
      // Use a valid URL that will timeout/fail when GCP tries to call it
      postUrl = 'https://example.invalid/webhook'
      taskName = 'gcp_unreachable_task'

      constructor() {
        super({ connector: cloudTaskConnector })
      }

      public async handle(): Promise<undefined> {
        return undefined
      }
    }

    const task = new UnreachableTask()
    const status = await task.queue({ text: 'This endpoint is unreachable' })

    expect(status).toHaveProperty('id')
    expect(status.status).toBe('QUEUED')

    // The task will eventually fail since the endpoint is unreachable
    // We just verify we can queue and get status
    const fullStatus = await task.getStatus(status.id)
    expect(fullStatus).toHaveProperty('payload')
  })

  it('should encrypt task body to base64 string', () => {
    const original = { text: 'secret data', nested: { value: 123 } }

    // encryptBody expects an object with 'content' key containing stringified data
    const encrypted = cloudTaskConnector.encryptBody({
      content: JSON.stringify(original)
    })

    expect(encrypted).toBeDefined()
    expect(typeof encrypted === 'string').toBe(true)
    // Should be base64 encoded
    expect(() => Buffer.from(encrypted as string, 'base64')).not.toThrow()
  })
})
