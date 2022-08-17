import { FindManyOptions } from 'typeorm'
import { FluentQuery } from '../../../types'
import { GeneratedModelRelations } from '../../util/getRelationsFromModelGenerator'
import { getMongoLookup } from './getMongoLookup'
import { getMongoSelect } from './getMongoSelect'

export type getFindAggregateQueryParams<T extends FluentQuery<any>> = {
  query?: T
  where?: FindManyOptions['where']
  modelRelations: GeneratedModelRelations['relations']
}
/**
 *
 * @param query
 * @returns
 */
export const getMongoFindAggregatedQuery = ({
  query,
  where,
  modelRelations
}: getFindAggregateQueryParams<any>): any[] => {
  const selected = getMongoSelect(query?.select)

  const lookups = getMongoLookup({
    include: query?.include,
    modelRelations
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

  for (const lookup of lookups) {
    aggregate.push(lookup)
  }

  if (selected && Object.keys(selected).length) {
    aggregate.push({
      $project: selected
    })
  }

  return aggregate
}
