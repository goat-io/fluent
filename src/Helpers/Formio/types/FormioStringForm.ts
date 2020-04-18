import { AccessType } from './AccessType'

export interface FormioStringForm {
  [key: string]: any
  title?: string
  name?: string
  path?: string
  type?: string
  display?: string
  action?: string
  tags?: string[]
  deleted?: number
  access?: AccessType[]
  submissionAccess?: AccessType[]
  owner?: string
  components?: string
  settings?: { [key: string]: any }
  properties?: { [key: string]: any }
}
