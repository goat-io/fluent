import { Type } from '../common'
import { ResolveTypeFn } from '../interfaces/resolve-type-fn.interface'

export interface UnionMetadata<T extends Type<unknown>[] = Type<unknown>[]> {
  name: string
  typesFn: () => T
  id?: symbol
  description?: string
  resolveType?: ResolveTypeFn
}
