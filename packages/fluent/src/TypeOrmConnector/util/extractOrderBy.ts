import { Objects } from '@goatlab/js-utils'
import { FluentQuery } from '../../types'

export const extractOrderBy = <T>(orderBy?: FluentQuery<T>['orderBy']) => {
  if (!orderBy) {
    return {}
  }

  // Handle both array and object formats
  const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy]

  if (orderByArray.length === 0) {
    return {}
  }

  const order = {}

  for (const orderElement of orderByArray) {
    const flattenOrder = Objects.flatten(orderElement)

    for (const k of Object.keys(flattenOrder)) {
      order[k] = flattenOrder[k]
    }
  }

  return Objects.nest(order)
}
