import { Type, isFunction, isString } from '../common'
import 'reflect-metadata'
import {
  createApiPropertyDecorator,
  DECORATORS
} from '../decorators/api-property.decorator'
import { METADATA_FACTORY_NAME } from '../type-metadata.storage'

export class ModelPropertiesAccessor {
  getModelProperties(prototype: Type<unknown>): string[] {
    const properties =
      Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, prototype) ||
      []

    return properties
      .filter(isString)
      .filter(
        (key: string) => key.charAt(0) === ':' && !isFunction(prototype[key])
      )
      .map((key: string) => key.slice(1))
  }

  applyMetadataFactory(prototype: Type<unknown>) {
    const classPrototype = prototype
    do {
      if (!prototype.constructor) {
        return
      }
      if (!prototype.constructor[METADATA_FACTORY_NAME]) {
        continue
      }
      const metadata = prototype.constructor[METADATA_FACTORY_NAME]()
      const properties = Object.keys(metadata)
      properties.forEach(key => {
        createApiPropertyDecorator(metadata[key], false)(classPrototype, key)
      })
    } while (
      (prototype = Reflect.getPrototypeOf(prototype) as Type<any>) &&
      prototype !== Object.prototype &&
      prototype
    )
  }
}
