import { Type } from './common'
import { omit } from 'lodash'
import { ApiProperty, DECORATORS } from './decorators/api-property.decorator'
import { clonePluginMetadataFactory } from './utils/mapped-types.utils'
import { ModelPropertiesAccessor } from './utils/model-properties-accessor'
import {
  inheritPropertyInitializers,
  inheritTransformationMetadata,
  inheritValidationMetadata
} from './decorators/apply-is-optional.decorator'

const modelPropertiesAccessor = new ModelPropertiesAccessor()

export function OmitType<T, K extends keyof T>(
  classRef: Type<T>,
  keys: readonly K[]
): Type<Omit<T, typeof keys[number]>> {
  const fields = modelPropertiesAccessor
    .getModelProperties(classRef.prototype)
    .filter(item => !keys.includes(item as K))

  const isInheritedPredicate = (propertyKey: string) =>
    !keys.includes(propertyKey as K)
  abstract class OmitTypeClass {
    constructor() {
      inheritPropertyInitializers(this, classRef, isInheritedPredicate)
    }
  }

  inheritValidationMetadata(classRef, OmitTypeClass, isInheritedPredicate)
  inheritTransformationMetadata(classRef, OmitTypeClass, isInheritedPredicate)

  clonePluginMetadataFactory(
    OmitTypeClass as Type<unknown>,
    classRef.prototype,
    (metadata: Record<string, any>) => omit(metadata, keys)
  )

  fields.forEach(propertyKey => {
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      classRef.prototype,
      propertyKey
    )
    const decoratorFactory = ApiProperty(metadata)
    decoratorFactory(OmitTypeClass.prototype, propertyKey)
  })
  return OmitTypeClass as Type<Omit<T, typeof keys[number]>>
}
