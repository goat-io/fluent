import { AnyObject, FluentQuery } from '../../../types'
import { GeneratedModelRelations } from '../../util/getRelationsFromModelGenerator'
import { getMongoWhere } from './getMongoWhere'

export interface getMongoBaseAggregationParams {
  include: FluentQuery<AnyObject>['include']
  self: any
  alias?: string
}
/**
 *
 * @param include
 * @returns
 */
export const getMongoBaseAggregation = ({
  include,
  self
}: getMongoBaseAggregationParams): any[] => {
  if (!include) {
    return []
  }

  const modelRelations: GeneratedModelRelations['relations'] =
    self.modelRelations

  const aggregations: any[] = []

  for (const relation of Object.keys(include)) {
    if (!modelRelations[relation]) {
      continue
    }

    const innerLookups: any[] = []
    const dbRelation = modelRelations[relation]

    // Nested Includes
    if (include[relation]['include']) {
      const newSelf = self[relation] && self[relation]()

      const innerRelations = getMongoBaseAggregation({
        include: include[relation]['include'],
        self: newSelf
      })

      innerLookups.push(...innerRelations)
    }

    const where = getMongoWhere({
      where: include[relation]['where']
    })

    console.log(where)


    if (dbRelation.isManyToOne) {
      const localField = dbRelation.joinColumns[0].propertyPath
      aggregations.push({
        $addFields: {
          [`${localField}_object`]: { $toObjectId: `$${localField}` }
        }
      })
      // Include Id in the results as we use it in every fluent query
      aggregations.push({ $addFields: { id: { $toString: '$_id' } } })
      aggregations.push({
        $lookup: {
          from: dbRelation.tableName,
          localField: `${localField}_object`,
          foreignField: '_id',
          as: dbRelation.propertyName,
          pipeline: [
            {
              $match: where
            },
            { $addFields: { id: { $toString: '$_id' } } },
            ...innerLookups
            //{ $limit: 2 }
          ]
        }
      })

      aggregations.push({ $unwind: `$${dbRelation.propertyName}` })
    }

    if (dbRelation.isOneToMany) {
      aggregations.push({ $addFields: { string_id: { $toString: '$_id' } } })
      aggregations.push({ $addFields: { id: { $toString: '$_id' } } })
      aggregations.push({
        $lookup: {
          from: dbRelation.tableName,
          localField: 'string_id',
          foreignField: dbRelation.inverseSidePropertyPath,
          as: dbRelation.propertyName,
          pipeline: [
            {
              $match: where
            },
            { $addFields: { id: { $toString: '$_id' } } },
            ...innerLookups
            //{ $limit: 2 }
          ]
        }
      })
    }

    if (dbRelation.isManyToMany) {
      const relatedTableName = dbRelation.tableName
      const pivotTableName =
        dbRelation.joinColumns[0].relationMetadata.joinTableName
      const pivotForeignField = dbRelation.joinColumns[0].propertyPath
      const inverseForeignField = dbRelation.inverseJoinColumns[0].propertyPath

      if (
        !relatedTableName ||
        !pivotTableName ||
        !pivotForeignField ||
        !inverseForeignField
      ) {
        throw new Error(
          `Your many to many relation is not properly set up. Please check both your models and schema for relation: ${relation}`
        )
      }

      aggregations.push({ $addFields: { id: { $toString: '$_id' } } })
      aggregations.push({
        $addFields: { parent_string_id: { $toString: '$_id' } }
      })
      aggregations.push({
        $lookup: {
          from: pivotTableName,
          localField: 'parent_string_id',
          foreignField: pivotForeignField,
          as: dbRelation.propertyName,
          pipeline: [
            // This is the pivot table
            { $addFields: { id: { $toString: '$_id' } } },
            {
              $addFields: {
                [`${inverseForeignField}_object`]: {
                  $toObjectId: `$${inverseForeignField}`
                }
              }
            },
            // The other side of the relationShip
            {
              $lookup: {
                from: relatedTableName,
                localField: `${inverseForeignField}_object`,
                foreignField: '_id',
                pipeline: [
                  {
                    $match: where
                  },
                  { $addFields: { id: { $toString: '$_id' } } }
                  // Here we could add more filters like
                  //{ $limit: 2 }
                ],
                as: dbRelation.propertyName
              }
            },
            { $unwind: `$${dbRelation.propertyName}` },
            // Select (ish)
            {
              $project: {
                [dbRelation.propertyName]: `$${dbRelation.propertyName}`,
                pivot: '$$ROOT'
              }
            },
            {
              $replaceRoot: {
                newRoot: {
                  $mergeObjects: ['$$ROOT', `$${dbRelation.propertyName}`]
                }
              }
            },
            { $project: { [dbRelation.propertyName]: 0 } }
            // Here we could add more filters like
            //{ $limit: 2 }
          ]
        }
      })
    }
  }

  return aggregations
}
