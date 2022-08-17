import { AnyObject, FluentQuery } from '../../../types'
import { GeneratedModelRelations } from '../../util/getRelationsFromModelGenerator'

export interface getMongoLookupParams {
  include: FluentQuery<AnyObject>['include']
  modelRelations: GeneratedModelRelations['relations']
}
/**
 *
 * @param include
 * @returns
 */
export const getMongoLookup = ({
  include,
  modelRelations
}: getMongoLookupParams): any[] => {
  if (!include) {
    return []
  }

  const lookUps: any[] = []
  for (const relation of Object.keys(include)) {
    if (modelRelations[relation]) {
      const dbRelation = modelRelations[relation]

      if (dbRelation.isManyToOne) {
        const localField = dbRelation.joinColumns[0].propertyPath
        lookUps.push({
          $addFields: {
            [`${localField}_object`]: { $toObjectId: `$${localField}` }
          }
        })
        // Include Id in the results as we use it in every fluent query
        lookUps.push({ $addFields: { id: { $toString: '$_id' } } })

        lookUps.push({
          $lookup: {
            from: dbRelation.tableName,
            localField: `${localField}_object`,
            foreignField: '_id',
            as: dbRelation.propertyName,
            pipeline: [
              { $addFields: { id: { $toString: '$_id' } } }
              //{ $limit: 2 }
            ]
          }
        })

        lookUps.push({ $unwind: `$${dbRelation.propertyName}` })
      }

      if (dbRelation.isOneToMany) {
        lookUps.push({ $addFields: { string_id: { $toString: '$_id' } } })
        lookUps.push({ $addFields: { id: { $toString: '$_id' } } })
        lookUps.push({
          $lookup: {
            from: dbRelation.tableName,
            localField: 'string_id',
            foreignField: dbRelation.inverseSidePropertyPath,
            as: dbRelation.propertyName,
            pipeline: [
              { $addFields: { id: { $toString: '$_id' } } }
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
        const inverseForeignField =
          dbRelation.inverseJoinColumns[0].propertyPath

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

        lookUps.push({ $addFields: { id: { $toString: '$_id' } } })
        lookUps.push({
          $addFields: { parent_string_id: { $toString: '$_id' } }
        })
        lookUps.push({
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
  }

  return lookUps
}
