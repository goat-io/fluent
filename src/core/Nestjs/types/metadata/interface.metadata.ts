import { ResolveTypeFn } from '../interfaces/resolve-type-fn.interface'
import { ClassMetadata } from './class.metadata'

export interface InterfaceMetadata extends ClassMetadata {
  resolveType?: ResolveTypeFn
  interfaces?: Function | Function[] | (() => Function | Function[])
}
