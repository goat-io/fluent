/**
 * The API surface of this module has been heavily inspired by the "type-graphql" library (https://github.com/MichalLytek/type-graphql), originally designed & released by Michal Lytek.
 */

import { Complexity } from '../interfaces/complexity.interface'
import { FieldMiddleware } from '../interfaces/field-middleware.interface'
import { BaseTypeOptions } from '../interfaces/base-type-options.interface'
import { ReturnTypeFunc } from '../interfaces/return-type-func.interface'
import { LazyMetadataStorage } from '../lazy-metadata.storage'
import { TypeMetadataStorage } from '../type-metadata.storage'
import { reflectTypeFromMetadata } from '../reflection.utils'
import { Type, isFunction } from '../common'

/**
 * Interface defining options that can be passed to `@Field()` decorator.
 */
export interface FieldOptions extends BaseTypeOptions {
  /**
   * Name of the field.
   */
  name?: string
  /**
   * Description of the field.
   */
  description?: string
  /**
   * Field deprecation reason (if deprecated).
   */
  deprecationReason?: string
  /**
   * Field complexity options.
   */
  complexity?: Complexity
  /**
   * Array of middleware to apply.
   */
  middleware?: FieldMiddleware[]
}

/**
 * @Field() decorator is used to mark a specific class property as a GraphQL field.
 * Only properties decorated with this decorator will be defined in the schema.
 */
export function Field(): PropertyDecorator & MethodDecorator
/**
 * @Field() decorator is used to mark a specific class property as a GraphQL field.
 * Only properties decorated with this decorator will be defined in the schema.
 */
export function Field(
  options: FieldOptions
): PropertyDecorator & MethodDecorator
/**
 * @Field() decorator is used to mark a specific class property as a GraphQL field.
 * Only properties decorated with this decorator will be defined in the schema.
 */
export function Field(
  returnTypeFunction?: ReturnTypeFunc,
  options?: FieldOptions
): PropertyDecorator & MethodDecorator
/**
 * @Field() decorator is used to mark a specific class property as a GraphQL field.
 * Only properties decorated with this decorator will be defined in the schema.
 */
export function Field(
  typeOrOptions?: ReturnTypeFunc | FieldOptions,
  fieldOptions?: FieldOptions
): PropertyDecorator & MethodDecorator {
  return (
    prototype: Object,
    propertyKey?: string,
    descriptor?: TypedPropertyDescriptor<any>
  ) => {
    addFieldMetadata(
      typeOrOptions,
      fieldOptions,
      prototype,
      propertyKey,
      descriptor
    )
  }
}

export function addFieldMetadata(
  typeOrOptions: ReturnTypeFunc | FieldOptions,
  fieldOptions: FieldOptions,
  prototype: Object,
  propertyKey?: string,
  descriptor?: TypedPropertyDescriptor<any>,
  loadEagerly?: boolean
) {
  const [typeFunc, options = {}] = isFunction(typeOrOptions)
    ? [typeOrOptions, fieldOptions]
    : [undefined, typeOrOptions as any]

  const applyMetadataFn = () => {
    const isResolver = !!descriptor
    const isResolverMethod = !!(descriptor && descriptor.value)

    const { typeFn: getType, options: typeOptions } = reflectTypeFromMetadata({
      metadataKey: isResolverMethod ? 'design:returntype' : 'design:type',
      prototype,
      propertyKey,
      explicitTypeFn: typeFunc as ReturnTypeFunc,
      typeOptions: options
    })

    TypeMetadataStorage.addClassFieldMetadata({
      name: propertyKey,
      schemaName: options.name || propertyKey,
      typeFn: getType,
      options: typeOptions,
      target: prototype.constructor,
      description: options.description,
      deprecationReason: options.deprecationReason,
      complexity: options.complexity,
      middleware: options.middleware
    })

    if (isResolver) {
      TypeMetadataStorage.addResolverPropertyMetadata({
        kind: 'internal',
        methodName: propertyKey,
        schemaName: options.name || propertyKey,
        target: prototype.constructor,
        complexity: options.complexity
      })
    }
  }
  if (loadEagerly) {
    applyMetadataFn()
  } else {
    LazyMetadataStorage.store(
      prototype.constructor as Type<unknown>,
      applyMetadataFn,
      { isField: true }
    )
  }
}
