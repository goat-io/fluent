import { FindManyOptions } from 'typeorm'
import { FluentQuery } from '../../../types'
import { getMongoBaseAggregation } from './getMongoBaseAggregations'
import { getMongoSelect } from './getMongoSelect'

export type getFindAggregateQueryParams<T extends FluentQuery<any>> = {
  query?: T
  where?: FindManyOptions['where']
  self?: any
}
/**
 *
 * @param query
 * @returns
 */
export const getMongoFindAggregatedQuery = ({
  query,
  where,
  self
}: getFindAggregateQueryParams<any>): any[] => {
  const selected = getMongoSelect(query?.select)

  const baseAggregations = getMongoBaseAggregation({
    include: query?.include,
    self
  })

  const aggregate: any[] = [
    {
      $match: where
    }
    // Any order be
    //{ $sort: { createdAt: 1 } }
  ]

  if (query?.limit) {
    aggregate.push({ $limit: query.limit! })
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
