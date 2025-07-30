import { Type } from '../common'
import { Complexity } from '../interfaces/complexity.interface'
import { GqlTypeReference } from '../interfaces/return-type-func.interface'
import { TypeOptions } from '../interfaces/type-options.interface'
import { DirectiveMetadata } from './directive.metadata'
import { MethodArgsMetadata } from './param.metadata'

export interface ResolverClassMetadata {
  target: Function
  typeFn: (of?: undefined) => Type<unknown> | Function
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
  typeFn: (type?: undefined) => GqlTypeReference
  returnTypeOptions: TypeOptions
}

export interface FieldResolverMetadata extends BaseResolverMetadata {
  kind: 'internal' | 'external'
  typeOptions?: TypeOptions
  typeFn?: (type?: undefined) => GqlTypeReference
  objectTypeFn?: (of?: undefined) => Type<unknown> | Function
}
