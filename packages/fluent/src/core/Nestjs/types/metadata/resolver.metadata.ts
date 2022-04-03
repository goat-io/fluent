import { GqlTypeReference } from '../interfaces/return-type-func.interface'
import { TypeOptions } from '../interfaces/type-options.interface'
import { Type } from '../common'
import { DirectiveMetadata } from './directive.metadata'
import { MethodArgsMetadata } from './param.metadata'
import { Complexity } from '../interfaces/complexity.interface'

export interface ResolverClassMetadata {
  target: Function
  typeFn: (of?: void) => Type<unknown> | Function
  isAbstract?: boolean
  parent?: ResolverClassMetadata
}

export interface BaseResolverMetadata {
  target: Function
  methodName: string
  schemaName: string
  description?: string
  deprecationReason?: string
  methodArgs?: MethodArgsMetadata[]
  classMetadata?: ResolverClassMetadata
  directives?: DirectiveMetadata[]
  extensions?: Record<string, unknown>
  complexity?: Complexity
}

export interface ResolverTypeMetadata extends BaseResolverMetadata {
  typeFn: (type?: void) => GqlTypeReference
  returnTypeOptions: TypeOptions
}

export interface FieldResolverMetadata extends BaseResolverMetadata {
  kind: 'internal' | 'external'
  typeOptions?: TypeOptions
  typeFn?: (type?: void) => GqlTypeReference
  objectTypeFn?: (of?: void) => Type<unknown> | Function
}
