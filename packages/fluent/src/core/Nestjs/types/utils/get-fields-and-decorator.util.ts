import 'reflect-metadata'
import { Type, ClassType } from '../common'
import { ArgsType } from '../decorators/args-type.decorator'
import { InputType } from '../decorators/input-type.decorator'
import { InterfaceType } from '../decorators/interface-type.decorator'
import { UnableToFindFieldsError } from '../errors/unable-to-find-fields.error'
import { CLASS_TYPE_METADATA } from '../interfaces/add-class-type-metadata.util'
import { ClassMetadata, PropertyMetadata } from '../metadata'
import { ObjectType } from '../object-type.decorator'
import { LazyMetadataStorage } from '../lazy-metadata.storage'
import { TypeMetadataStorage } from '../type-metadata.storage'

export function getFieldsAndDecoratorForType<T>(objType: Type<T>) {
  const classType = Reflect.getMetadata(CLASS_TYPE_METADATA, objType)

  if (!classType) {
    throw new UnableToFindFieldsError(objType.name)
  }

  LazyMetadataStorage.load([objType], {
    skipFieldLazyMetadata: true
  })

  const [classMetadata, decoratorFactory] =
    getClassMetadataAndFactoryByTargetAndType(classType, objType)

  TypeMetadataStorage.loadClassPluginMetadata([classMetadata])
  TypeMetadataStorage.compileClassMetadata([classMetadata])

  let fields = classMetadata?.properties
  if (!fields) {
    throw new UnableToFindFieldsError(objType.name)
  }
  fields = inheritClassFields(objType, fields)

  return {
    fields,
    decoratorFactory
  }
}

type ClassDecorator =
  | typeof ArgsType
  | typeof InterfaceType
  | typeof ObjectType
  | typeof InputType
type MetadataAndFactoryTuple = [ClassMetadata | undefined, ClassDecorator]

function getClassMetadataAndFactoryByTargetAndType(
  classType: ClassType,
  objType: Type<unknown>
): MetadataAndFactoryTuple {
  switch (classType) {
    case ClassType.ARGS:
      return [
        TypeMetadataStorage.getArgumentsMetadataByTarget(objType),
        ArgsType
      ]
    case ClassType.OBJECT:
      return [
        TypeMetadataStorage.getObjectTypeMetadataByTarget(objType),
        ObjectType
      ]
    case ClassType.INPUT:
      return [
        TypeMetadataStorage.getInputTypeMetadataByTarget(objType),
        InputType
      ]
    case ClassType.INTERFACE:
      return [
        TypeMetadataStorage.getInterfaceMetadataByTarget(objType),
        InterfaceType
      ]
  }
}

function inheritClassFields(
  objType: Type<unknown>,
  fields: PropertyMetadata[]
) {
  try {
    const parentClass = Object.getPrototypeOf(objType)
    if (parentClass === Function) {
      return fields
    }
    const { fields: parentFields } = getFieldsAndDecoratorForType(
      parentClass as Type<unknown>
    )
    return inheritClassFields(parentClass, [...parentFields, ...fields])
  } catch (err) {
    return fields
  }
}
