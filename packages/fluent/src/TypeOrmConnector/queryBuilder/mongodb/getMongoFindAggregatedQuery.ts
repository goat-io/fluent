import { FindManyOptions } from 'typeorm'
import { FluentQuery } from '../../../types'
import { getMongoBaseAggregation } from './getMongoBaseAggregations'
import { getMongoOrderBy } from './getMongoOrderBy'
import { getMongoSelect } from './getMongoSelect'
import { getMongoWhere } from './getMongoWhere'

export type getFindAggregateQueryParams<T extends FluentQuery<any>> = {
  query?: T
  self?: any
}
/**
 *
 * @param query
 * @returns
 */
export const getMongoFindAggregatedQuery = ({
  query,
  self
}: getFindAggregateQueryParams<any>): any[] => {
  self.initDB()
  const selected = getMongoSelect(query?.select)
  const orderBy = getMongoOrderBy(query?.orderBy)

  const where = getMongoWhere({
    where: query?.where
  })

  const baseAggregations = getMongoBaseAggregation({
    include: query?.include,
    self
  })

  const aggregate: any[] = [
    {
      $match: where
    }
  ]

  if (orderBy) {
    aggregate.push(orderBy)
  }

  if (!query?.include) {
    aggregate.push({ $addFields: { id: { $toString: '$_id' } } })
  }

  if (query?.offset) {
    aggregate.push({ $skip: query?.offset })
  }

  if (query?.limit) {
    aggregate.push({ $limit: query.limit })
  }

  for (const lookup of baseAggregations) {
    aggregate.push(lookup)
  }

  if (selected && Object.keys(selected).length) {
    aggregate.push({
      $project: selected
    })
  }

  return aggregate
}
