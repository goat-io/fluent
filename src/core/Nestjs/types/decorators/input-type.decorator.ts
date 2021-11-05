/**
 * The API surface of this module has been heavily inspired by the "type-graphql" library (https://github.com/MichalLytek/type-graphql), originally designed & released by Michal Lytek.
 */
import { ClassType, isString } from '../common'
import { LazyMetadataStorage } from '../lazy-metadata.storage'
import { TypeMetadataStorage } from '../type-metadata.storage'
import { addClassTypeMetadata } from '../interfaces/add-class-type-metadata.util'

/**
 * Interface defining options that can be passed to `@InputType()` decorator.
 */
export interface InputTypeOptions {
  /**
   * Description of the input type.
   */
  description?: string
  /**
   * If `true`, type will not be registered in the schema.
   */
  isAbstract?: boolean
}

/**
 * Decorator that marks a class as a GraphQL input type.
 */
export function InputType(): ClassDecorator
/**
 * Decorator that marks a class as a GraphQL input type.
 */
export function InputType(options: InputTypeOptions): ClassDecorator
/**
 * Decorator that marks a class as a GraphQL input type.
 */
export function InputType(
  name: string,
  options?: InputTypeOptions
): ClassDecorator
/**
 * Decorator that marks a class as a GraphQL input type.
 */
export function InputType(
  nameOrOptions?: string | InputTypeOptions,
  inputTypeOptions?: InputTypeOptions
): ClassDecorator {
  const [name, options = {}] = isString(nameOrOptions)
    ? [nameOrOptions, inputTypeOptions]
    : [undefined, nameOrOptions]

  return target => {
    const metadata = {
      target,
      name: name || target.name,
      description: options.description,
      isAbstract: options.isAbstract
    }
    LazyMetadataStorage.store(() =>
      TypeMetadataStorage.addInputTypeMetadata(metadata)
    )
    addClassTypeMetadata(target, ClassType.INPUT)
  }
}
