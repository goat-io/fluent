import { flatten, isUndefined, Type } from './common'

const NO_TARGET_METADATA = Symbol('NO_TARGET_METADATA')
const FIELD_LAZY_METADATA = Symbol('FIELD_LAZY_METADATA')

export class LazyMetadataStorageHost {
  private readonly lazyMetadataByTarget = new Map<
    Type<unknown> | symbol,
    ((...args: any[]) => any)[]
  >()

  store(func: (...args: any[]) => any): void
  store(target: Type<unknown>, func: (...args: any[]) => any): void
  store(
    target: Type<unknown>,
    func: (...args: any[]) => any,
    options?: { isField: boolean }
  ): void
  store(
    targetOrFn: Type<unknown> | ((...args: any[]) => any),
    func?: (...args: any[]) => any,
    options?: { isField: boolean }
  ) {
    if (func && options?.isField) {
      this.updateStorage(FIELD_LAZY_METADATA, func)
      this.updateStorage(targetOrFn as Type<unknown>, func)
    } else if (func) {
      this.updateStorage(targetOrFn as Type<unknown>, func)
    } else {
      this.updateStorage(
        NO_TARGET_METADATA,
        targetOrFn as (...args: any[]) => any
      )
    }
  }

  load(
    types: ((...args: any[]) => any)[] = [],
    options: {
      skipFieldLazyMetadata?: boolean
    } = {
      skipFieldLazyMetadata: false
    }
  ) {
    types = this.concatPrototypes(types)

    let loadersToExecute = flatten(
      types
        .map(target =>
          this.lazyMetadataByTarget.get(target as unknown as Type<unknown>)
        )
        .filter(metadata => metadata)
    )

    loadersToExecute = loadersToExecute?.concat(
      ...(this.lazyMetadataByTarget.get(NO_TARGET_METADATA) || [])
    )

    if (!options.skipFieldLazyMetadata) {
      loadersToExecute = loadersToExecute?.concat(
        ...(this.lazyMetadataByTarget.get(FIELD_LAZY_METADATA) || [])
      )
    }
    loadersToExecute?.forEach(func => func())
  }

  private concatPrototypes(
    types: ((...args: any[]) => any)[]
  ): ((...args: any[]) => any)[] {
    const typesWithPrototypes = types
      .filter(type => type?.prototype)
      .map(type => {
        const parentTypes: any[] = []

        let parent: (...args: any[]) => any = type
        while (!isUndefined(parent.prototype)) {
          parent = Object.getPrototypeOf(parent)
          if (parent === Function.prototype) {
            break
          }
          parentTypes.push(parent)
        }
        parentTypes.push(type)
        return parentTypes
      })

    return flatten(typesWithPrototypes)
  }

  private updateStorage(
    key: symbol | Type<unknown>,
    func: (...args: any[]) => any
  ) {
    const existingArray = this.lazyMetadataByTarget.get(key)
    if (existingArray) {
      existingArray.push(func)
    } else {
      this.lazyMetadataByTarget.set(key, [func])
    }
  }
}

const globalRef = global as any
export const LazyMetadataStorage: LazyMetadataStorageHost =
  (globalRef.GqlLazyMetadataStorageHost ||= new LazyMetadataStorageHost())
