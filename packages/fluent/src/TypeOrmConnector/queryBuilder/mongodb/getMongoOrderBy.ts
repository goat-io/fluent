import { extractOrderBy } from '../../util/extractOrderBy'
import { FluentQuery } from '../../../types'

export const getMongoOrderBy = (orderBy?: FluentQuery<any>['orderBy']) => {
  if (!orderBy) {
    return undefined
  }
  const order = extractOrderBy(orderBy as any)

  const sort = {
    $sort: {}
  }

  for (const key of Object.keys(order)) {
    const val = order[key]
    sort.$sort[key] = val === 'asc' ? 1 : -1
  }

  return sort
}
