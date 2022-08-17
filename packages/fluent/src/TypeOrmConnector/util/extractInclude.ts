import { Objects } from '@goatlab/js-utils'
import { AnyObject, FluentQuery } from '../../types'

export const extractInclude = <T>(
  include?: FluentQuery<T>['include']
) => {
  if (!include) {
    return undefined
  }
  const flatten = Objects.flatten(include)
  const extractedInclude: AnyObject = {}

  for (const key of Object.keys(flatten)) {
    if (key.includes('include')) {
      const parsedKey = key.split('.include')

      let acc = ''
      for (const entity of parsedKey) {
        extractedInclude[`${acc}${entity}`] = true
        acc = acc + entity
      }

      continue
    }

    extractedInclude[key] = true
  }

  return extractedInclude
}
