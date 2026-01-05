import { isFunction, Type } from '../common'
import { ClassDecoratorFactory } from '../interfaces/class-decorator-factory.interface'
import { METADATA_FACTORY_NAME } from '../type-metadata.storage'
import { getFieldsAndDecoratorForType } from '../utils/get-fields-and-decorator.util'
import { applyFieldDecorators } from '../utils/type-helpers.utils'
import {
  applyIsOptionalDecorator,
  inheritPropertyInitializers,
  inheritTransformationMetadata,
  inheritValidationMetadata,
} from './apply-is-optional.decorator'
import { Field } from './field.decorator'

export function PartialType<T>(
  classRef: Type<T>,
  decorator?: ClassDecoratorFactory,
): Type<Partial<T>> {
  const { fields, decoratorFactory } = getFieldsAndDecoratorForType(classRef)

  abstract class PartialObjectType {
    constructor() {
      inheritPropertyInitializers(this, classRef)
    }
  }
  if (decorator) {
    decorator({ isAbstract: true })(PartialObjectType)
  } else {
    decoratorFactory({ isAbstract: true })(PartialObjectType)
  }

  inheritValidationMetadata(classRef, PartialObjectType)
  inheritTransformationMetadata(classRef, PartialObjectType)

  fields.forEach(item => {
    if (isFunction(item.typeFn)) {
      /**
       * Execute type function eagarly to update the type options object (before "clone" operation)
       * when the passed function (e.g., @Field(() => Type)) lazily returns an array.
       */
      item.typeFn()
    }
    Field(item.typeFn, { ...item.options, nullable: true })(
      PartialObjectType.prototype,
      item.name,
    )
    applyIsOptionalDecorator(PartialObjectType, item.name)
    applyFieldDecorators(PartialObjectType, item)
  })

  if (PartialObjectType[METADATA_FACTORY_NAME]) {
    const pluginFields = Object.keys(PartialObjectType[METADATA_FACTORY_NAME]())
    pluginFields.forEach(key =>
      applyIsOptionalDecorator(PartialObjectType, key),
    )
  }

  Object.defineProperty(PartialObjectType, 'name', {
    value: `Partial${classRef.name}`,
  })
  return PartialObjectType as Type<Partial<T>>
}
