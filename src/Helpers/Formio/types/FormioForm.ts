import { AccessType } from './AccessType'
import { FormioComponent } from './FormioComponent'

export interface FormioForm {
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
  components?: FormioComponent[]
  settings?: { [key: string]: any }
  properties?: { [key: string]: any }
}
