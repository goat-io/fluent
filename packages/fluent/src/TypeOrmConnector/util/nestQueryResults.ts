import { Arrays } from '@goatlab/js-utils'
import { AnyObject } from '../../types'

export const nestQueryResults = (
  results: AnyObject[],
  keyToNestedKeyMap: AnyObject
): AnyObject[] => {
  let nestableObject = {}
  let currentLevel = 0
  // For each of the keys that we need to map
  for (const key of Object.keys(keyToNestedKeyMap)) {
    if (!key.endsWith('_id')) {
      continue
    }

    const currentLevelMetadata = keyToNestedKeyMap[key]
    currentLevel = currentLevelMetadata.level

    // We only group by Ids of the current level
    const grouped: AnyObject = Arrays.groupBy(results, r => r[key])

    const resultCount = Object.keys(grouped)?.length || 0

    // ForEach Id of the grouped results
    for (const [index, k] of Object.keys(grouped).entries()) {
      const prefixindex = currentLevelMetadata.nestableKey.lastIndexOf('.')
      const prefix = currentLevelMetadata.nestableKey.substring(0, prefixindex)
      const currentIndex = `${prefix}.${index}.${currentLevelMetadata.keyName}`
      const results = grouped[k]

      console.log(currentLevelMetadata)
      // Get current level values
      if (currentLevelMetadata.level === currentLevel) {
        // Get value of the id
        nestableObject[`${currentIndex}`] = k
      }

      for (const result of results) {
      }
    }

    // currentLevel = currentLevelMetadata.level
  }
  return results
}
