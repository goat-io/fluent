import { Objects } from '@goatlab/js-utils'
import { FluentQuery } from 'types'

export const extractOrderBy = <T>(orderBy?: FluentQuery<T>['orderBy']) => {
  if (!orderBy || !Array.isArray(orderBy) || orderBy.length === 0) {
    return {}
  }

  const order = {}

  for (const orderElement of orderBy!) {
    const flattenOrder = Objects.flatten(orderElement)

    for (const k of Object.keys(flattenOrder)) {
      order[k] = flattenOrder[k]
    }
  }

  return Objects.nest(order)
}
