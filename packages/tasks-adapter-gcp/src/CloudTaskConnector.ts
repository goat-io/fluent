import type {
  TaskConnector,
  TaskStatus,
  TaskStatusName
} from '@goatlab/tasks-core'
import type { BackoffSettings } from 'google-gax/build/src/gax'
import { assert, Ids, Memo, Primitive, Promises } from '@goatlab/js-utils'
import { Security } from '@goatlab/node-utils'
import { GCPServiceAccount } from 'CloudTaskConnector.types'
export type ITask = any

export type { BackoffSettings }

const defaultBackoffSettings: BackoffSettings = {
  maxRetries: 2,
  initialRetryDelayMillis: 2000,
  retryDelayMultiplier: 1.5,
  maxRetryDelayMillis: 3600,
  initialRpcTimeoutMillis: 6000
}

function getScheduledInfo(scheduled: number): {
  minutesUntil: number
} {
  if (scheduled === 0) {
    return {
      minutesUntil: 0
    }
  }
  const scheduledMs = scheduled * 1000
  const nowMs = Date.now()

  const minutesUntil = Math.floor((scheduledMs - nowMs) / 1000 / 60)

  return { minutesUntil }
}

export class CloudTaskConnector implements TaskConnector<object> {
  private gcpServiceAccount: GCPServiceAccount
  private location: string
  private encryptionKey: string
  private gcpProject: string

  constructor({
    gcpServiceAccount,
    location,
    encryptionKey,
    gcpProject
  }: {
    gcpServiceAccount?: any
    location?: string
    encryptionKey?: string
    gcpProject: string
  }) {
    this.gcpServiceAccount = gcpServiceAccount || ''
    this.location = location || 'europe-west1'
    this.encryptionKey = encryptionKey || ''
    this.gcpProject = gcpProject || ''
  }

  @Memo.asyncMethod()
  private async getCloudTasksClient() {
    const cloudTasks = await import('@google-cloud/tasks')

    console.log(
      `Initializing cloud-tasks pointing at project: ${this.gcpProject}`
    )

    return new cloudTasks.CloudTasksClient({
      credentials: this.gcpServiceAccount,
      projectId: this.gcpProject
    })
  }
  /**
   * Adds a task to the Cloud Tasks queue.
   *
   */
  async addTask({
    task,
    queueName = 'default',
    backoffSettings = defaultBackoffSettings,
    baseUrl
  }: {
    task: ITask
    queueName: string
    backoffSettings: any
    baseUrl?: string
  }) {
    assert(task.httpRequest, `task.httpRequest property is required`)

    const { url } = task.httpRequest

    const parseUrl = async (urlString?: string | null) => {
      if (!urlString) {
        return
      }

      // urlService.getBackendUrl({
      //   useIP: true
      // })

      return new URL(urlString, baseUrl)
    }

    assert(url, 'Task URL is required')

    // Parse URL to point to the correct backend
    const parsedURL = await parseUrl(url)

    assert(parsedURL, 'Task URL is invalid')

    const client = await this.getCloudTasksClient()
    const parent = client.queuePath(this.gcpProject, this.location, queueName)

    // According to docs it is needed
    if (task.name && !task.name.startsWith(parent)) {
      task = {
        ...task,
        name: `${parent}/tasks/${task.name}`
      }
    }

    task = {
      ...task,
      httpRequest: {
        ...task.httpRequest,
        url: parsedURL.href
      }
    }

    task = {
      ...task,
      httpRequest: {
        ...task.httpRequest,
        headers: {
          'content-type': 'application/octet-stream'
        },
        // We can encrypt the content to later verify that it was sent by us
        body: this.encryptBody({
          content: String(task.httpRequest?.body)
        })
      }
    }

    // Skip sending tasks in local environment
    // this will make the task run before
    // the endpoint returns
    // if (env.local) {
    //   if (!task.httpRequest?.url) {
    //     return task
    //   }
    //   // Voiding to avoid waiting for the task
    //   void fetch(task.httpRequest.url, {
    //     method: 'POST',
    //     headers: {
    //       'local-queue': 'true',
    //       ...task.httpRequest?.headers
    //     },
    //     body: task.httpRequest?.body,
    //     signal: AbortSignal.timeout(120_000)
    //   })
    //   return task
    // }

    const [response] = await client.createTask(
      {
        parent,
        task
      },
      {
        retry: {
          retryCodes: [
            2, // UNKNOWN
            14 // INTERNAL
          ],
          backoffSettings
        }
      }
    )

    return response
  }

  /**
   * Lists all failed tasks in the specified queue.
   * It filters tasks that have been dispatched more than twice,
   * indicating they have failed.
   *
   * @param queueName - Name of the queue to list failed tasks from.
   * @returns An array of failed tasks.
   */
  async listFailedTasks(queueName = 'default') {
    const client = await this.getCloudTasksClient()
    const parent = client.queuePath(this.gcpProject, this.location, queueName)

    // We have to be careful with the response, as it can be large.
    const [tasks] = await client.listTasks({ parent, responseView: 'FULL' })

    return tasks.filter(task => {
      return task.dispatchCount || 0 > 2
    })
  }

  /**
   * Decrypts the body of a task.
   * This service encrypts the body of the task before sending it,
   * so this method is used to decrypt it back to its original form.
   * It expects the body to be a Buffer or string, and it will parse it as JSON.
   * If the body is not provided, it defaults to an empty Buffer.
   *
   * @param body - The body of the task, which is expected to be a Buffer or string.
   * @returns The decrypted body as a Record<string, Primitive>.
   */
  decryptBody(body?: Buffer | null | string | any) {
    const buffer = body || Buffer.alloc(0)

    const bodyJSON = JSON.parse(
      typeof buffer === 'string'
        ? buffer
        : Buffer.from(buffer).toString('ascii')
    )

    const decryptedBody = Security.decryptObject(
      bodyJSON,
      this.encryptionKey
    ) as any

    return JSON.parse(decryptedBody.content) as Record<string, Primitive>
  }

  /**
   * Encrypts the body of a task.
   * This service encrypts the body of the task before sending it,
   * so this method is used to encrypt it.
   * It expects the body to be a Record<string, any> and returns a base64 encoded string.
   *
   * @param obj - The object to encrypt.
   * @returns The encrypted body as a base64 encoded string.
   */

  encryptBody(obj: Record<string, any>): string | Uint8Array {
    const encrypted = Security.encryptObject(obj, this.encryptionKey)

    return Buffer.from(JSON.stringify(encrypted)).toString('base64')
  }

  /**
   * Gets the status of a task by its name.
   * Implements the TaskConnector interface.
   * @param name - Name of the task.
   */
  async getStatus(name: string): Promise<TaskStatus> {
    const client = await this.getCloudTasksClient()
    const [error, resp] = await Promises.try(
      client.getTask({ name, responseView: 'FULL' })
    )

    // This in most cases will mean success, given that the tasks get removed once they are done
    if (error?.message.includes('The task no longer exists')) {
      return {
        id: name,
        name: name?.split('/').pop() || '',
        output: error?.message,
        attempts: 0,
        status: 'COMPLETED',
        created: new Date().toISOString(),
        nextRun: null,
        nextRunMinutes: null,
        payload: {}
      }
    }

    const task = resp[0]

    const creation: number = Number(task.createTime?.seconds || 0) || 0
    const scheduled: number = Number(task.scheduleTime?.seconds || 0) || 0
    const payload = this.decryptBody(task.httpRequest?.body)

    let status: TaskStatusName = 'RUNNING'

    if (
      (task.responseCount === 0 && (task.dispatchCount ?? 0) > 2) ||
      (task.responseCount === 0 &&
        (task.dispatchCount === 1 || task.dispatchCount === 0))
    ) {
      status = 'FAILED'
    } else if (
      typeof task.responseCount === 'number' &&
      task.responseCount > 0
    ) {
      status = 'COMPLETED'
    }

    return {
      id: task.name || '',
      name: task.name?.split('/').pop() || '',
      attempts: task.dispatchCount ?? 0,
      output: task.lastAttempt?.responseStatus?.message || '',
      status,
      created: new Date(creation * 1000).toISOString(),
      nextRun: new Date(scheduled * 1000).toISOString(),
      nextRunMinutes: getScheduledInfo(scheduled).minutesUntil,
      payload
    }
  }

  /**
   * Schedules a task to be run in the future.
   * Implements the TaskConnector interface.
   * @param params
   * @param params.taskName - Name of the task.
   * @param params.postUrl - URL to post the task to.
   * @param params.taskBody - Body of the task.
   */
  async queue(params: any): Promise<Omit<TaskStatus, 'payload'>> {
    const task = await this.addTask({
      task: {
        name: `${params.taskName}_${Ids.nanoId(5)}`,
        httpRequest: {
          url: params.postUrl,
          body: JSON.stringify(params.taskBody)
        }
      },
      queueName: params.queueName || 'default',
      backoffSettings: defaultBackoffSettings
    })

    const creation: number = Number(task.createTime?.seconds || 0) || 0
    const scheduled: number = Number(task.scheduleTime?.seconds || 0) || 0

    return {
      id: task.name,
      name: task.name.split('/').pop() || '',
      output: '',
      attempts: 0,
      status: 'QUEUED',
      created: new Date(creation * 1000).toISOString(),
      nextRun: new Date(scheduled * 1000).toISOString(),
      nextRunMinutes: null
    }
  }
}
