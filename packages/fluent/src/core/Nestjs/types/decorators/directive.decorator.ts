import { parse } from 'graphql'
import { DirectiveParsingError } from '../errors/directive-parsing.error'
import { LazyMetadataStorage } from '../lazy-metadata.storage'
import { TypeMetadataStorage } from '../type-metadata.storage'

/**
 * Adds a directive to specified field, type, or handler.
 */
export function Directive(
  sdl: string,
): MethodDecorator & PropertyDecorator & ClassDecorator {
  return (
    target: ((...args: any[]) => any) | object,
    key?: string | symbol,
  ) => {
    validateDirective(sdl)

    LazyMetadataStorage.store(() => {
      if (key) {
        TypeMetadataStorage.addDirectivePropertyMetadata({
          target: target.constructor as new (...args: any[]) => any,
          fieldName: key as string,
          sdl,
        })
      } else {
        TypeMetadataStorage.addDirectiveMetadata({
          target: target as unknown as new (...args: any[]) => any,
          sdl,
        })
      }
    })
  }
}

function validateDirective(sdl: string) {
  try {
    parse(`type String ${sdl}`)
  } catch (_err) {
    throw new DirectiveParsingError(sdl)
  }
}
