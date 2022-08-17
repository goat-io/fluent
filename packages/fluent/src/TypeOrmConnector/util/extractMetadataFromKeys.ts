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

export const extractMetadataFromKeys = (keys: string[]): KeysMetadataResponse => {
  // Example of a key
  // Level 0:
  //    users__id
  // Level 2:
  //    users___XXOneToManyXX___cars___XXManyToOneXX___user__id
  const keyToNestedKeyMap = {}

  for (const key of keys) {
    // All keys have an _ before the actual attribute name
    const preAttributeIndex = key.lastIndexOf('_')
    const fullTableAlias = key.slice(0, preAttributeIndex).replace('_', '')
    const keyName = key.slice(preAttributeIndex + 1, key.length)

    const flattened = fullTableAlias
      .replace(/___XXManyToOneXX/g, '')
      .replace(/___XXOneToManyXX/g, '')
      .replace(/___/g, '.')
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
        .replace(/___/g, '') || undefined

    var level = (key.match(/XX___/g) || []).length

    keyToNestedKeyMap[key] = {
      keyName,
      nestableKey: `${flattened}.${keyName}`,
      relation,
      parentRelation,
      level,
      cardinality:
        cardinality && cardinality.replace(/XX/g, '').replace(/___/g, '')
    }
  }

  return keyToNestedKeyMap
}
