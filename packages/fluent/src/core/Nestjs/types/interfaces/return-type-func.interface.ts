import { GraphQLScalarType } from 'graphql'
import { Type } from '../common'

export type GqlTypeReference =
  | Type<any>
  | GraphQLScalarType
  | Function
  | object
  | symbol
export type ReturnTypeFuncValue = GqlTypeReference | [GqlTypeReference]
export type ReturnTypeFunc = (returns?: void) => ReturnTypeFuncValue
