export type TaskStatusName =
  | 'QUEUED'
  | 'RUNNING'
  | 'FAILED'
  | 'COMPLETED'
  | 'CANCELLED'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [x: string]: JsonValue }
  | JsonValue[]

export type JsonObject = { [x: string]: JsonValue }

export type InputType = {
  [x: string]: JsonValue
} & {
  [x: string]: JsonValue
}

export type OutputType = void | JsonObject
export type UnknownInputType = {}

export interface TaskStatus<T extends InputType = UnknownInputType> {
  id: string
  name: string
  status: TaskStatusName
  output: string
  attempts: number
  created: string
  nextRun: string | null
  nextRunMinutes: number | null
  payload: T
}

export interface TaskConnector<TInput> {
  queue(params: {
    taskName: string
    postUrl: string
    taskBody: TInput
    handle: () => Promise<any>
  }): Promise<Omit<TaskStatus, 'payload'>>
  getStatus(id: string): Promise<TaskStatus>
}
