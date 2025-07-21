import type { TypesenseCollection, TypesenseCollectionField } from '../typesense.model'

/**
 * Helper type to preserve literal types
 */
type Literal<T> = T extends string ? T : never

/**
 * Maps field type to TypeScript type
 */
type FieldTypeToTS<T extends TypesenseCollectionField['type']> = 
  T extends 'string' ? string :
  T extends 'string[]' ? string[] :
  T extends 'int32' | 'int64' ? number :
  T extends 'int32[]' | 'int64[]' ? number[] :
  T extends 'float' ? number :
  T extends 'float[]' ? number[] :
  T extends 'bool' ? boolean :
  T extends 'bool[]' ? boolean[] :
  T extends 'geopoint' ? [number, number] :
  T extends 'geopoint[]' ? [number, number][] :
  T extends 'auto' ? string | string[] :
  T extends 'object' ? Record<string, any> :
  T extends 'object[]' ? Record<string, any>[] :
  any

/**
 * Extract required fields (fields without optional: true)
 */
type RequiredFields<C extends TypesenseCollection> = Exclude<
  C['fields'][number],
  { optional: true }
>

/**
 * Extract optional fields
 */
type OptionalFields<C extends TypesenseCollection> = Extract<
  C['fields'][number],
  { optional: true }
>

/**
 * Map required fields to object type
 */
type RequiredFieldsType<C extends TypesenseCollection> = {
  [F in RequiredFields<C> as Literal<F['name']> extends 'id' ? never : Literal<F['name']>]: FieldTypeToTS<F['type']>
}

/**
 * Map optional fields to object type
 */
type OptionalFieldsType<C extends TypesenseCollection> = {
  [F in OptionalFields<C> as Literal<F['name']> extends 'id' ? never : Literal<F['name']>]?: FieldTypeToTS<F['type']>
}

/**
 * Infers the document type from a collection (excluding id for TypesenseApi compatibility)
 */
export type InferDocumentType<C extends TypesenseCollection> = RequiredFieldsType<C> & OptionalFieldsType<C>

/**
 * Infers the TypeScript type from a collection definition
 */
export type InferFromCollection<C extends TypesenseCollection> = InferDocumentType<C>

/**
 * Helper to create a typed collection definition
 */
export function defineCollection<const C extends TypesenseCollection>(collection: C): C {
  return collection
}