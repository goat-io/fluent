import { METADATA_FACTORY_NAME } from '../type-metadata.storage'
import { DECORATORS } from './api-property.decorator'

const isUndefined = val => typeof val === 'undefined'

const OmitBy = (obj, check) => {
  obj = { ...obj }
  Object.entries(obj).forEach(([key, value]) => check(value) && delete obj[key])
  return obj
}

export function createPropertyDecorator<T extends Record<string, any> = any>(
  metakey: string,
  metadata: T,
  overrideExisting = true
): PropertyDecorator {
  return (target: object, propertyKey: string) => {
    const properties =
      Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, target) || []

    const key = `:${propertyKey}`
    if (!properties.includes(key)) {
      Reflect.defineMetadata(
        DECORATORS.API_MODEL_PROPERTIES_ARRAY,
        [...properties, `:${propertyKey}`],
        target
      )
    }
    const existingMetadata = Reflect.getMetadata(metakey, target, propertyKey)
    if (existingMetadata) {
      const newMetadata = OmitBy(metadata, isUndefined)
      const metadataToSave = overrideExisting
        ? {
            ...existingMetadata,
            ...newMetadata
          }
        : {
            ...newMetadata,
            ...existingMetadata
          }

      Reflect.defineMetadata(metakey, metadataToSave, target, propertyKey)
    } else {
      const type =
        target?.constructor?.[METADATA_FACTORY_NAME]?.()[propertyKey]?.type ??
        Reflect.getMetadata('design:type', target, propertyKey)

      Reflect.defineMetadata(
        metakey,
        {
          type,
          ...OmitBy(metadata, isUndefined)
        },
        target,
        propertyKey
      )
    }
  }
}

export function getTypeIsArrayTuple(
  input: Function | [Function] | undefined | string | Record<string, any>,
  isArrayFlag: boolean
): [Function | undefined, boolean] {
  if (!input) {
    return [input as undefined, isArrayFlag]
  }
  if (isArrayFlag) {
    return [input as Function, isArrayFlag]
  }
  const isInputArray = Array.isArray(input)
  const type = isInputArray ? input[0] : input
  return [type as Function, isInputArray]
}
