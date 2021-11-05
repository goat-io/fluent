import { LazyMetadataStorage } from '../lazy-metadata.storage'
import { TypeMetadataStorage } from '../type-metadata.storage'
import { addClassTypeMetadata } from '../interfaces/add-class-type-metadata.util'
import { ClassType } from '../common'

/**
 * Decorator that marks a class as a resolver arguments type.
 */
export function ArgsType(): ClassDecorator {
  return (target: Function) => {
    const metadata = {
      name: target.name,
      target
    }
    LazyMetadataStorage.store(() =>
      TypeMetadataStorage.addArgsMetadata(metadata)
    )
    // This function must be called eagerly to allow resolvers
    // accessing the "name" property
    TypeMetadataStorage.addArgsMetadata(metadata)
    addClassTypeMetadata(target, ClassType.ARGS)
  }
}
