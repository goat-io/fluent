export interface KeysMetadata {
  keyName: string
  nestableKey: string
  relation?: string
  parentRelation?: string
  level?: number
  // ManyToOne, OneToMany
  cardinality?: string
}

export interface KeysMetadataResponse {
  [key: string]: KeysMetadata
}

// Cache for regex patterns
const REGEX_CACHE = {
  manyToOne: /___XXManyToOneXX/g,
  oneToMany: /___XXOneToManyXX/g,
  tripleSep: /___/g,
  xxPattern: /XX___/g,
  xxReplace: /XX/g
}

export const extractMetadataFromKeys = (keys: string[]): KeysMetadataResponse => {
  // Example of a key
  // Level 0:
  //    users__id
  // Level 2:
  //    users___XXOneToManyXX___cars___XXManyToOneXX___user__id
  const keyToNestedKeyMap = Object.create(null)

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!
    // All keys have an _ before the actual attribute name
    const preAttributeIndex = key.lastIndexOf('_')
    const fullTableAlias = key.slice(0, preAttributeIndex).replace('_', '')
    const keyName = key.slice(preAttributeIndex + 1)

    const flattened = fullTableAlias
      .replace(REGEX_CACHE.manyToOne, '')
      .replace(REGEX_CACHE.oneToMany, '')
      .replace(REGEX_CACHE.tripleSep, '.')
      .replace('__', '.')
      .replace('.XXOneToManyXX', '')

    const possibleCurrentTableKey = key.lastIndexOf('___')

    const relation =
      possibleCurrentTableKey <= 0
        ? undefined
        : key.slice(possibleCurrentTableKey + 3, preAttributeIndex)

    const possibleParentTableKeyInit = key.lastIndexOf('___XX')
    const possibleParentTableKeyEnd = key.lastIndexOf('XX__')

    const cardinality =
      key.slice(possibleParentTableKeyInit, possibleParentTableKeyEnd) ||
      undefined

    const parentRelationKey = key
      .substring(0, possibleParentTableKeyInit)
      .lastIndexOf('___')

    const parentRelation =
      key
        .substring(parentRelationKey, possibleParentTableKeyInit)
        .replace(REGEX_CACHE.tripleSep, '') || undefined

    const levelMatches = key.match(REGEX_CACHE.xxPattern)
    const level = levelMatches ? levelMatches.length : 0

    keyToNestedKeyMap[key] = {
      keyName,
      nestableKey: `${flattened}.${keyName}`,
      relation,
      parentRelation,
      level,
      cardinality:
        cardinality && cardinality.replace(REGEX_CACHE.xxReplace, '').replace(REGEX_CACHE.tripleSep, '')
    }
  }

  return keyToNestedKeyMap
}
