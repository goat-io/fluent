import { ClassType } from '../common'
import { SetMetadata } from '../set-metadata.decorator'

export const CLASS_TYPE_METADATA = 'graphql:class_type'

export function addClassTypeMetadata(target: Function, classType: ClassType) {
  const decoratorFactory: ClassDecorator = SetMetadata(
    CLASS_TYPE_METADATA,
    classType,
  )
  decoratorFactory(target)
}
